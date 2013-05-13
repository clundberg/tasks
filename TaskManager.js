/*
	A Task is one thing that needs to get done
	_id: Unique ID of the task that needs completing
*/
/*

label     e.g. "Generate analysis", "Pick up kids"

assignee	 e.g. { type:"module", 
						  module:"channels/DummyChannel.js", 
						  method: "process" 
						}
				       OR {type:"user", user_id:"5123e49a238b2800bdae905b"}
		User or automatic system this task is assigned to
assigned_at: TS  2013-05-01T08:06:00.147Z
	Timestamp it was last assigned at

created_at	 : TS 2013-05-01T08:06:00.147Z

start_after: TS 2013-05-01T08:06:00.147Z
					OR a task_id, such as:
				 "5123e49a238b2800bdae905b"
		When to start this task.  Options are either a particular time, or after another task has completed, or after multiple tasks have completed
	
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
	
persistence: {Object} Optional
	{     
		collection: <collection name>
		_id:<id in collection> 
		property: Optional:  <property for sub-object in main object>
	}
	 Used for cross task communication
	
filters  {
		e.g. campaign_id:"123-a",
		e.g. project_id:"453-a"
	}
	Create only.  Optional.  Can hold any number of attributes that can be filtered on, such as project, campaign, workspace, workflow ID's, etc.

*/

var mongo_util=require("./lib/mongo_util.js");
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

	this.taskCollection=(typeof opts.task_collection=='string')?db.collection(opts.task_collection):opts.task_collection;
	this.auditCollection=(typeof opts.audit_collection=='string')?db.collection(opts.audit_collection):opts.audit_collection;
}


TaskManager.prototype.load=function(task,callback){
	if (typeof task=='object' && task._id){
		callback(task);
	}else{
		console.log("Loading "+JSON.stringify(task));
		this.taskCollection.findOne({_id:mongo_util.getObjectID(task)},function(err,fullTask){
			if (err) throw err;
			if (!fullTask) throw new Error("Could not find task "+task);
			callback(fullTask);
		});
	}
}

TaskManager.prototype.create=function(task,callback){
	task.status='new';
	task.created_at=new Date();
	var that=this;
	console.log("saving "+task.label);
	that.taskCollection.save(task,function(){
		that.auditCollection.save({ts:new Date(), task_id:task._id, status:task.status,task:task},function(err){
				if (err) throw err;
				if (callback) callback(task);
			});
	});
}


TaskManager.prototype._update=function(task,callback){
	var that=this;
	this.load(task,function(task){
		task.modified_at=new Date();
		if (task.completed && !task.completed_at) task.completed_at=task.modified_at;
		that.taskCollection.save(task,function(err){
			if (err) throw err;
			
			that.auditCollection.save({ts:new Date(), task_id:task._id, status:task.status,task:task},function(err){
				if (err) throw err;
				if (callback) callback(task);
			});
			
		});
	});
}

/* Mark a task as errored */
TaskManager.prototype.error=function(task,message,callback){
	task.error_stack=new Error(message).stack;
	var that=this;
	this.load(task,function(task){
		task.status='error';
		task.error_message=message;
		that._update(task,callback);
	}) ;
}

TaskManager.prototype.progress=function(task,progress,callback){
	var that=this;
	this.load(task,function(task){
		task.progress=progress;
		that._update(task,callback);
	}) ;
}


/*
	Assign to a particular person or item.
	If assignee is null, just keep whatever was in the task.
*/
TaskManager.prototype.assign=function(task,assignee,callback){
	var that=this;
	this.load(task,function(task){
		task.status='assigned';
		if (assignee) task.assignee=assignee;
		//if (!task.assignee) throw "Could not find assignee in "+JSON.stringify(task);
		task.assigned_at=new Date();
		that._update(task,callback);
	});
}

/*
	Mark a task as completed
*/
TaskManager.prototype.complete=function(task,callback){
	var that=this;
	this.load(task,function(task){
		task.status='complete';
		//completed_at will be reset by _update, so remove any old ones
		delete task.completed_at;
		that._update(task,callback);
	});
}

module.exports=TaskManager;