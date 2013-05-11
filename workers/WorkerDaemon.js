/*
	WorkerDaemon waits for tasks, constructs a task, 
		then spawns the appropriate library and processes the task
*/
if (!process.env.MONGO_URI) throw "MONGO_URI environment variable is required";

var mongo_util=require("../lib/mongo_util.js"), file_util=require("../lib/file_util.js");
var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});


/*

	task_collection: Name of collection to read tasks from
	audit_collection: Name of collection to read task modifications from
	persistence_collection: Optional collection that can persist data between tasks

*/

var WorkerDaemon=function(opts){
	opts=opts ||{};
	this.taskCollection=(typeof opts.task_collection=='string')?db.collection(opts.task_collection):opts.task_collection;
	this.auditCollection=(typeof opts.audit_collection=='string')?db.collection(opts.audit_collection):opts.audit_collection;
	console.log(this.auditCollection);
	
	if (opts.persistence_collection){
		this.persistenceCollection=(typeof opts.audit_collection=='string')?db.collection(opts.persistence_collection):opts.persistence_collection;
	}
	
	this.TaskManager=new (require("../TaskManager.js"))(opts);
	
	this.q={};
	if (opts.q){
		this.q=opts.q;
	}
}

function executeTask(task,persistenceObject,callback){
		var options=task_data.options;
		if (persistenceObject && typeof options=='function'){
			options=options.call(persistenceObject);
		}
		
		var workerDef=require("./"+task.assignee.library);
		
	
		var worker=new workerDef();
		//Optional -- a task can specify a context_id that will allow other tasks to find it
		//this allows for easy cross task communication
		if (task.persistance_property){
			 persistence[task.persistance_property]=persistence[task.persistance_property] ||{};
			 worker[task.assignee.method].call(persistence[task.persistance_property],task,options);
		}else{
			//otherwise the context is assumed to be the worker itself
			worker[task.assignee.method](task,options);
		}
		if (callback) callback(persistenceObject);
};

WorkerDaemon.prototype.start=function(){
		console.log("Worker daemon starting to read tasks.....");
		var that=this;
		this.auditCollection.find(this.q, {'tailable': 1, 'sort': [['$natural', 1]]}, function(err, cursor) {
			if (!cursor) return;
			cursor.each(function(err, audit_data) {
				if (err) throw err;
				
				if (!audit_data) return;
				if (!audit_data.task_id) return;
				
				that.TaskManager.load(audit_data.task_id,function(task){
					if (!task.assignee){return that.TaskManager.error(task,"No assignee for task");}
					if (typeof task.assignee!='object'){return that.TaskManager.error(task,"Assignee is not an object");}
					if (!task.assignee.library) return that.TaskManager.error(task,"A library parameter is required for a task assignee");
					if (!task.assignee.method) return that.TaskManager.error(task,"A method parameter is required for a task assignee");
					try{
						file_util.validateFilename(task.assignee.library);
					}catch(e){
						return that.TaskManager.error(task,"Invalid library name");
					}
				
					if (task_data.persistence_id && persistenceCollection){
						executeTask(task);
					}else{
						that.persistenceCollection.findOne(mongo_util.getObjectID(task_data.persistence_id),function(err,persistenceObject){
							if (err){return task.error(err);}
							if (!persistenceObject){return that.TaskManager.error(task,"Could not find persistence");}
							executeTask(task,persistenceObject,function(modifiedObject){
								that.persistenceCollection.save(modifiedObject,function(err){
									if (err){
										//This isn't just a TASK error, this is a fundamental problem
										console.error("ERROR:  Problem saving persistence object");
									}
								});
							});
						});
					}
				});
		});
	});
}

module.exports=WorkerDaemon;