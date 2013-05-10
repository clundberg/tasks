/*
	WorkerDaemon waits for tasks, constructs a task, 
		then spawns the appropriate library and processes the task
*/
if (!process.env.MONGO_URI) throw "MONGO_URI environment variable is required";

var mongo_util=require("../lib/mongo_util.js"), file_util=require("../lib/file_util.js");
var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});

var persistenceCollection=null;
var Task=require("../Task.js");

/*

task_collection: Name of collection to read tasks from
persist_collection: Otional

*/

var WorkerDaemon=function(opts){
	opts=opts ||{};
	this.taskCollection=(typeof opts.task_collection=='string')?db.collection(opts.collection):opts.collection;
	
	if (opts.persist_collection){
		this.persistenceCollection=db.collection(opts.persist.collection);
	}
	
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
		this.taskCollection.find(this.q, {'tailable': 1, 'sort': [['$natural', 1]]}, function(err, cursor) {
			if (!cursor) return;
			cursor.each(function(err, task_data) {
				if (err) throw err;
				if (!task_data) return;
				var task=new Task(task_data);
				
				if (!task.assignee){return task.error("No assignee for task");}
				if (typeof task.assignee!='object'){return task.error("Assignee is not an object");}
				if (!task.assignee.library) return task.error("A library parameter is required for a task assignee");
				if (!task.assignee.method) return task.error("A method parameter is required for a task assignee");
				try{
					file_util.validateFilename(task.assignee.library);
				}catch(e){
					return task.error("Invalid library name");
				}
				
				if (task_data.persistence_id && persistenceCollection){
					executeTask(task);
				}else{
					persistenceCollection.findOne(mongo_util.getObjectID(task_data.persistence_id),function(err,persistenceObject){
						if (err){return task.error(err);}
						if (!persistenceObject){return task.error("Could not find persistence");}
						executeTask(task,persistenceObject,function(modifiedObject){
							persistenceCollection.save(modifiedObject,function(err){
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
}

module.exports=WorkerDaemon;