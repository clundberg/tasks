/*
	WorkerDaemon waits for tasks, constructs a task, 
		then spawns the appropriate module and processes the task
*/
if (!process.env.MONGO_URI) throw "MONGO_URI environment variable is required";

var mongo_util=require("../lib/mongo_util.js"), file_util=require("../lib/file_util.js"), async=require("async");
var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});

/*

	task_collection: Name of collection to read tasks from
	audit_collection: Name of collection to read task modifications from

*/

var WorkerDaemon=function(opts){
	opts=opts ||{};
	this.taskCollection=(typeof opts.task_collection=='string')?db.collection(opts.task_collection):opts.task_collection;
	this.auditCollection=(typeof opts.audit_collection=='string')?db.collection(opts.audit_collection):opts.audit_collection;
	
	this.TaskManager=new (require("../TaskManager.js"))(opts);
	
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
			if (persistenceObject){
				 worker[task.assignee.method].call(persistenceObject,task,options);
			}else{
				//otherwise the context is assumed to be the worker itself
				worker[task.assignee.method](task,options);
			}
		}catch(e){
			this.TaskManager.error(task,e);
		}
		
		if (callback) callback();
};


WorkerDaemon.prototype.checkTasks=function(q,callback){
	var that=this;
	console.log("Looking for "+JSON.stringify(q));
	that.taskCollection.find(q).toArray(function(err,tasks){
		if (err) throw err;
		async.eachSeries(tasks,function (task,seriesCallback){
			if (!tasks) return seriesCallback();
			 console.log("Processing task "+task._id);
			 
			 if (!task.assignee){return that.TaskManager.error(task,"No assignee for task "+task._id,seriesCallback);}
	
			 if (typeof task.assignee!='object'){return that.TaskManager.error(task,"Assignee is not an object",seriesCallback);}
			 if (!task.assignee.module) return that.TaskManager.error(task,"A module parameter is required for a task assignee",seriesCallback);
			 if (!task.assignee.method) return that.TaskManager.error(task,"A method parameter is required for a task assignee",seriesCallback);
			 try{
				 file_util.validateFilename(task.assignee.module);
			 }catch(e){
				 return that.TaskManager.error(task,"Invalid module name",seriesCallback);
			 }

			 if (task.persistence){
				 if (!task.persistence.collection || !task.persistence._id){return TaskManager.error(task,"task.persistence object must have a collection and _id",seriesCallback);}
				 db.collection(task.persistence.collection).findOne(mongo_util.getObjectID(task.persistence._id),function(err,persistenceRecord){
					 if (err){return TaskManager.error(task,err,seriesCallback);}
					 if (!persistenceRecord){return that.TaskManager.error(task,"Could not find _id "+task.persistence._id+" in collection "+task.persistence.collection,seriesCallback);}
					 var persistenceObject=persistenceRecord;
			
					 if (task.persistence.property){
						 //If it doesn't yet exist, add the property
						 persistenceRecord[task.persistence.property]=persistenceRecord[task.persistence.property]||{};
				
						 persistenceObject=persistenceRecord[task.persistence.property];
						 if (typeof persistenceObject!='object') return that.TaskManager.error(task,"Property '"+task.persistence.property+"' is not an object, it is "+typeof persistenceObject,seriesCallback);
					 }
					 that.executeTask(task,persistenceObject,function(){
						 db.collection(task.persistence.collection).save(persistenceRecord,function(err){
							 if (err){
								 //This isn't just a TASK error, this is a fundamental problem
								 console.error("ERROR:  Problem saving persistence object");
								 throw err;
							 }
							 seriesCallback();
						 });
					 });
				 });

			 }else{
				 executeTask(task,null,seriesCallback);
			 }
		 }, function(){
		 	callback(tasks.length);
		 });
	});
}

WorkerDaemon.prototype.start=function(){
		console.log("Worker daemon starting to read tasks.....");
		this.tailAudit();
		this.poll();
};



/*
	Periodically poll for tasks that start_after is a timestamp
*/
WorkerDaemon.prototype.justCompletedTasks=[];

//The current timeout value -- start it low, it will go up quickly if there is nothing to do
WorkerDaemon.prototype.timeout=64;

WorkerDaemon.prototype.poll=function(){
	var l=this.justCompletedTasks.length;
	var that=this;
	if (l>0){
		//If something just completed, then immediately check for new items
		var task_ids=this.justCompletedTasks.slice(0,l).map(function(i){return i.toString()});
		this.justCompletedTasks=this.justCompletedTasks.slice(l);

		var q={"start_after_task":{$in:task_ids}};
		this.checkTasks(q,function(count){
			that.poll();
		});
		
	}else{
		var q={status:"assigned",start_after_timestamp:{$lt:new Date()}}; that.checkTasks(q,function(count){
			//Adjust the timeout based on the results
			
			if (count==0){
				that.timeout=Math.max(64,Math.min(~~that.timeout*1.2,8192));
			}else{
				that.timeout=Math.max(64,Math.min(~~that.timeout/1.2,8192));
			}
			
			setTimeout(function(){that.poll()},that.timeout) ;
		})
	}
};


/*
	Tail the audit logs, looking for things that have just completed, and put it into the just completed task list
*/
WorkerDaemon.prototype.tailAudit=function(){
		var that=this;
		this.auditCollection.find(	{status:"complete"}, { tailable:true, 'sort': [['$natural', 1]]}, function runAuditCursor(err, cursor) {
			if (!cursor) return;
			function auditCallback(){};
			var cur=cursor;
			cursor.each(function(err,audit_data){
				if (err) throw err;
				if (!audit_data) return;
				if (!audit_data.task_id) return;
				that.justCompletedTasks.push(audit_data.task_id);
			});
		});
}

module.exports=WorkerDaemon;