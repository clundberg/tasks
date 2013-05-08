/****** Worker boilerplate *******/
var util = require('util'),	Worker = require('./Worker.js');

function WorkerImpl() {
  Worker.call(this);
}

util.inherits(WorkerImpl, Worker);

module.exports=WorkerImpl;
/* End boilerplate  */

/*
	 Do nothing but extend the current context with all the options values
*/

WorkerImpl.prototype.extendContext=function(task,options){
	for (i in options){this[i]=options[i];}
	
	task.complete();
}