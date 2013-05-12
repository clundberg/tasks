/*
	WorkerDaemon waits for tasks, constructs a task, 
		then spawns the appropriate module and processes the task
*/
if (!process.env.MONGO_URI) throw "MONGO_URI environment variable is required";

var mongo_util=require("../lib/mongo_util.js"), file_util=require("../lib/file_util.js");
var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});


/*

	task_collection: Name of collection to read tasks from
	audit_collection: Name of collection to read task modifications from
	
	q:{status:"assigned","task.assignee.type":"module"}

*/

var WorkerDaemon=function(opts){
	opts=opts ||{};
	this.taskCollection=(typeof opts.task_collection=='string')?db.collection(opts.task_collection):opts.task_collection;
	this.auditCollection=(typeof opts.audit_collection=='string')?db.collection(opts.audit_collection):opts.audit_collection;
	
	this.TaskManager=new (require("../TaskManager.js"))(opts);
	
	this.q={status:"assigned","task.assignee.type":"module"};

	if (opts.q){
		this.q=opts.q;
	}
}

WorkerDaemon.prototype.executeTask=function(task,persistenceObject,callback){
		
		var options=task.options;
		if (persistenceObject && typeof options=='function'){
			options=options.call(persistenceObject);
		}
		
		var workerDef=require("./"+task.assignee.module);
	
		var worker=new workerDef();
		var that=this;
		//Expose complete and error functions for
		task.complete=function(){console.log("Worker called complete"); that.TaskManager.complete(task);}
		task.error=function(msg){that.TaskManager.error(task,msg);}
		task.progress=function(progress){that.TaskManager.progress(task,progress);}
		
		try{
			if (task.persistance && task.persistence.property){
				 persistence[task.persistance.property]=persistence[task.persistance.property] ||{};
				 worker[task.assignee.method].call(persistence[task.persistance.property],task,options);
			}else{
				//otherwise the context is assumed to be the worker itself
				worker[task.assignee.method](task,options);
			}
		}catch(e){
			this.TaskManager.error(task,e);
		}
		
		if (callback) callback();
};

WorkerDaemon.prototype.start=function(){
		console.log("Worker daemon starting to read tasks.....");
		var that=this;
		this.auditCollection.find(this.q, {'tailable': 1, 'sort': [['$natural', 1]]}, function runAuditCursor(err, cursor) {
			if (!cursor) return;
			cursor.each(function processAuditRecord(err, audit_data) {
				if (err) throw err;
				
				console.log("Processing audit record "+audit_data._id);
				
				if (!audit_data) return;
				if (!audit_data.task_id) return;
				
				that.TaskManager.load(audit_data.task_id,function processTask(task){
					console.log(task);
					if (!task.assignee){return that.TaskManager.error(task,"No assignee for task "+task._id);}
					
					if (typeof task.assignee!='object'){return that.TaskManager.error(task,"Assignee is not an object");}
					if (!task.assignee.module) return that.TaskManager.error(task,"A module parameter is required for a task assignee");
					if (!task.assignee.method) return that.TaskManager.error(task,"A method parameter is required for a task assignee");
					try{
						file_util.validateFilename(task.assignee.module);
					}catch(e){
						return that.TaskManager.error(task,"Invalid module name");
					}
				
					if (task.persistence){
						if (!task.persistence.collection || !task.persistence._id){return TaskManager.error(task,"task.persistence object must have a collection and _id");}
						db.collection(task.persistence.collection).findOne(mongo_util.getObjectID(task.persistence._id),function(err,persistenceRecord){
							if (err){return TaskManager.error(task,err);}
							if (!persistenceRecord){return that.TaskManager.error(task,"Could not find _id "+task.persistence._id+" in collection "+task.persistence.collection);}
							var persistenceObject=persistenceRecord;
							
							if (task.persistence.property){
								//If it doesn't yet exist, add the property
								persistenceRecord[task.persistence.property]=persistenceRecord[task.persistence.property]||{};
								
								persistenceObject=persistenceRecord[task.persistence.property];
								if (typeof persistenceObject!='object') return that.TaskManager.error(task,"Property '"+task.persistence.property+"' is not an object, it is "+typeof persistenceObject);
							}
							
							that.executeTask(task,persistenceObject,function(){
								db.collection(task.persistence.collection).save(persistenceRecord,function(err){
									if (err){
										//This isn't just a TASK error, this is a fundamental problem
										console.error("ERROR:  Problem saving persistence object");
									}
								});
							});
						});

					}else{
						executeTask(task);
					}
				});
		});
	});
}

module.exports=WorkerDaemon;