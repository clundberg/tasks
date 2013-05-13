/****** Worker boilerplate *******/
var util = require('util'),	js_util=require('../../lib/js_util.js'),Worker = require('../Worker.js');
function WorkerImpl() {
  Worker.call(this);
}

util.inherits(WorkerImpl, Worker);
module.exports=WorkerImpl;
/* End boilerplate  */

WorkerImpl.prototype.getSchema=function(){
	return {
		html:{type: 'string', title: 'HTML Content',required: false},
	};
}

WorkerImpl.prototype.getFormHints=function(){
	return {};
}

WorkerImpl.prototype._update=function(task,options){
	options=options ||{};
	this.url="http://dummy-url/";
	this.content=js_util.extend(this.content || {},options.content);
	this.dummy_id=this.dummy_id || ~~(Math.random()*100000),
	console.log("Dummy job working on "+task._id);
	task.complete();
	//setTimeout(function(){console.log("Dummy Complete."); task.complete();},2000);
};

WorkerImpl.prototype.create=function(task,options){
	console.log("Creating dummy");
	this.status='created';
	WorkerImpl.prototype._update.call(this,task,options);
}

WorkerImpl.prototype.update=function(task,options){
	console.log("Updating dummy");
	this.status='updated';
	WorkerImpl.prototype._update.call(this,task,options);
}

WorkerImpl.prototype.target=function(task,options){
	console.log("Targeting dummy");
	this.status='targeted';
	WorkerImpl.prototype._update.call(this,task,options);
}
WorkerImpl.prototype.publish=function(task,options){
	console.log("Publishing dummy");
	this.status='published';
	WorkerImpl.prototype._update.call(this,task,options);
}
