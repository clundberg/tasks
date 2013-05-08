/*
	A Task is one thing that needs to get done
	_id: Unique ID of the task that needs completing
*/
/*
assignee	 { id: 1234, name: "Tim Bizarro" }
User to which this task is assigned, or null if the task is unassigned.
assignee_status	 upcoming
Scheduling status of this task for the user it is assigned to. One of the following values:
inbox	In the inbox.
later	Scheduled for later.
today	Scheduled for today.
upcoming	Marked as upcoming.
created_at	 2012-02-22T02:06:58.147Z
Read-only. The time at which this task was created.
completed	 false
True if the task is currently marked complete, false if not.
completed_at	 2012-02-22T02:06:58.147Z
Read-only. The time at which this task was completed, or null if the task is incomplete.
due_on	 2012-03-26
Date on which this task is due, or null if the task has no due date.
followers	 [ { id: 1123, name: "Mittens" }, ... ]
Read-only. Array of users following this task.
modified_at	 2012-02-22T02:06:58.147Z
Read-only. The time at which this task was last modified. 
Note: This does not currently reflect any changes in associations such as projects or comments that may have been added or removed from the task.
name	 Buy catnip
Name of the task. This is generally a short sentence fragment that fits on a line in the UI for maximum readability. However, it can be longer.
notes	 Mittens really likes the stuff from Humboldt.
More detailed, free-form textual information associated with the task.
projects	 [ { id: 1331, name: "Stuff to Buy" }, ... ]
Create-only. Array of projects this task is associated with. At task creation time, this array can be used to add the task to many projects at once. After task creation, these associations can be modified using the addProject and removeProject endpoints.
parent	 { id: 52992, name: "My Parent task" }
Read-only. The parent of this task, or null if this is not a subtask. This property cannot be modified using a PUT request but you can change it with the setParent endpoint. You can create subtasks by using the subtasks endpoint.
workspace	 { id: 14916, name: "My Workspace" }
Create-only. The workspace this task is associated with. Once created, task cannot be moved to a different workspace. This attribute can only be specified at creation time.
*/



var Task=function(opts){
	for (i in opts) this[i]=opts[i];
}

Task.prototype.error=function(message){
	var err=(typeof message=='string')?new Error(message):message;
	console.log(err);
	console.log(this);
}

Task.prototype.complete=function(){
	console.log("Calling Completed for "+this._id);
}

//Assign a person to accomplish this task
Task.prototype.assign=function(user){

}

module.exports=Task;
