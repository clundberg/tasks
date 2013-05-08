/*
	WorkerDaemon waits for tasks, constructs a task, 
		then spawns the appropriate library and processes the task
*/
if (!process.env.MONGO_URI) throw "MONGO_URI environment variable is required";

var mongo_util=require("../lib/mongo_util.js"), file_util=require("../lib/file_util.js");
var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});

var campaignCollection=db.collection("campaign");
var Task=require("../Task.js");

var WorkerDaemon=function(opts){
	opts=opts ||{};
	this.collection=(typeof opts.collection=='string')?db.collection(opts.collection):opts.collection;
	this.q={};
	if (opts.q){
		this.q=opts.q;
	}
}

WorkerDaemon.prototype.start=function(){
		console.log("Worker daemon starting to read tasks.....");
		this.collection.find(this.q, {'tailable': 1, 'sort': [['$natural', 1]]}, function(err, cursor) {
			if (!cursor) return;
			cursor.each(function(err, task_data) {
				if (err) throw err;
				if (!task_data) return;
				var task=new Task(task_data);
				task.collection=this.collection;
				
				campaignCollection.findOne(mongo_util.getObjectID(task_data.campaign_id),function(err,campaign){
					if (err){return task.error(err);}
					if (!campaign){return task.error("Could not find campaign");}
					if (!task.assignee){return task.error("No assignee for task");}
					if (typeof task.assignee!='object'){return task.error("Assignee is not an object");}
				
					var options=task_data.options;
					if (typeof options=='function'){
						options=options.call(campaign);
					}
				
					if (!task.assignee.library) return task.error("A library parameter is required for a task assignee");
					if (!task.assignee.method) return task.error("A method parameter is required for a task assignee");
					try{
						file_util.validateFilename(task.assignee.library);
					}catch(e){
						return task.error("Invalid library name");
					}
					
					var workerDef=require("./"+task.assignee.library);
				
					var worker=new workerDef();
					//Optional -- a task can specify a context_id that will allow other tasks to find it
					//this allows for easy cross task communication
					if (task.context_id){
						 campaign[task.context_id]=campaign[task.context_id] ||{};
						 worker[task.assignee.method].call(campaign[task.context_id],task,options);
					}else{
						//otherwise the context is assumed to be the worker itself
						worker[task.assignee.method](task,options);
					}
				});
		});
	});
}

module.exports=WorkerDaemon;