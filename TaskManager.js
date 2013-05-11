/*
	A Task is one thing that needs to get done
	_id: Unique ID of the task that needs completing
*/
/*

label Hit the town

assignee	 e.g. { type:"auto", library:"channels/DummyChannel.js", method: "process" }
				       OR {type:"user", user_id:"5123e49a238b2800bdae905b"}
		User or automatic system this task is assigned to

created_at	 : TS 2013-05-01T08:06:00.147Z
	
status:
	new
	assigned
	complete
	error
	
completed_at	 2013-05-01T08:06:00.147Z
	Read-only. The time at which this task was completed -- null if the task is incomplete.
due_on	 2012-03-26
	Date on which this task is due, or null if the task has no due date.
modified_at	 2013-05-01T08:06:00.147Z
	Read-only. Last modification timestamp


	
notes	 [
			]
			Array of more detailed descriptions and notes about the task
	
persistence_id  "5123e49a238b2800bdae905b"   Optional
		if persisting data across tasks, this identifies the object to persist with
persistence_property  "message123", "address"
	Create only.  Optional unique identifier to identify which element in a particular context this task applies to.
	
filters  {
		campaign_id:"123-a",
		project_id:"453-a"
	}
	Create only.  Optional.  Can hold any number of attributes that can be filtered on, such as project, campaign, workspace, workflow ID's, etc.

*/

var mongo_util=require("../lib/mongo_util.js");
var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});

/*
	Takes 2 collections -- 
		task_collection -- collection to find tasks in
		audit_collection -- collection to record audit history in
*/
var TaskManager=function(opts){
	opts=opts ||{};
	if (!opts.task_collection) throw "TaskManager: task_collection is a required option";
	if (!opts.audit_collection) throw "TaskManager: audit_collection is a required option";

	this.taskCollection=(typeof opts.task_collection=='string')?db.collection(opts.collection):opts.collection;

	this.auditCollection=(typeof opts.audit_collection=='string')?db.collection(opts.collection):opts.collection;
}


TaskManager.prototype.load(task,callback){
	if (typeof task=='object'){
		callback(task);
	}else{
		this.taskCollection.findOne({_id:mongo_util.getObjectID(task)},function(err,task){
			if (err) throw err;
			if (!task) throw "Could not find task "+task;
			callback(task);
		});
	}
}

TaskManager.prototype._save(task,callback){
	this.loadTask(task,function(task){
		task.modified_at=new Date();
		if (task.completed && !task.completed_at) task.completed_at=task.modified_at;
		this.taskCollection.save(task,function(err){
			if (err) throw err;
			
			auditCollection.save({ts:new Date(), task_id:task._id, status:task.status,task:task},function(err){
				if (err) throw err;
				if (callback) callback(task);
			});
			
		});
	});
}

/* Mark a task as errored */
TaskManager.prototype.error=function(task,message,callback){
	this.loadTask(task,function(task){
		task.status='error';
		task.error_message=message;
		this._save(task,callback);
	}) ;
}

/*
	Mark a task as completed
*/
TaskManager.prototype.complete=function(task,callback){
	this.loadTask(task,function(task){
		task.status='complete';
		delete task.completed_at;
		this._save(task,callback);
	});
}

//Assign a person to accomplish this task
TaskManager.prototype.assign=function(task,assignee,callback){
	this.loadTask(task,function(task){
		task.status='assigned';
		task.assignee=assignee;
		task.assignee_status='inbox';
		this._save(task,callback);
	});
}

module.exports=TaskManager;