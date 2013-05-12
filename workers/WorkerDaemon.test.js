console.log("Starting test");
var WorkerDaemon=require("./WorkerDaemon.js"),
	db=require('mongoskin').db(process.env.MONGO_URI,{safe:true}),
	async=require("async");

var taskCollection="worker_daemon_test_tasks";
var persistenceCollection="worker_daemon_test_persistence";
var auditCollection="worker_daemon_test_audit";


var tasks=[
{
	label:"Create code",
	assignee:{
		type:"module",
		module:"CommonTaskWorker.js",
		method:"extendContext"
	},
	persistence:{
		collection:persistenceCollection,
		property:"codes"
	},
	options:{campaign_code:"2013-04-01"}
},
{
	label:"Create TAF", 
	persistence:{
		collection:persistenceCollection,
		property:"taf"
	},
	assignee:{
		type:"module",
		module:"dummy/DummyMessage.js", 
		method:"create"
	},
	options:function(){
	 return js_util.renderMustacheObject({
	  content:{
			Reference_Name:"API {{codes.campaign_code}}",
			Title:"Thank You!"
	  }
	},this);
 	}
},
{
	label:"Create Email",
	persistence:{
		collection:persistenceCollection,
		property:"email1"
	},
	assignee:{
		type:"module",
		module:"dummy/DummyMessage.js",
		method:"create"
	},
	options:function(){
		return js_util.renderMustacheObject({
			content:{
				HTML_Content:"Click here: {{taf.url}}"
			}
		},this);
	 }
 },
	{
		label:"Publish TAF",
		persistence:{
			collection:persistenceCollection,
			property:"email1"
		},
		assignee:{
			type:"module",
			module:"dummy/DummyMessage.js",
			method:"publish"
		}
	}
];

//This MUST be created inside of mongo
//CANNOT currently created capped collections through node.js
//
//at least one record is required, otherwise the tailable cursor doesn't work
/*
 db.worker_daemon_test_tasks.drop();
 db.createCollection("worker_daemon_test_tasks", {capped:true, size:100000});
 db.worker_daemon_test_tasks.save({});
 */


function resetCollection(name,opts,callback){
	console.log("Resetting "+name);
	 db.collection(name).drop(function(err){
	 if (err) throw err;
		 db.createCollection(name, opts || {},function(err, cb){
			if (err) throw err;
			callback();
		});	 
	});
}

function cleanup(){
	db.collection(taskCollection).drop(function(err){
		db.collection(persistenceCollection).drop(function(err){
			db.collection(auditCollection).drop(function(err){
			});
		});
	});
}

resetCollection(taskCollection,{},function(){
	resetCollection(auditCollection,{capped:true, size:10000,max:1000},function(){
		resetCollection(persistenceCollection,{},function(){
		
		 	var auditColl=db.collection(auditCollection);
				//at least one record is required, otherwise the tailable cursor doesn't work
				auditColl.save({},function(err){if (err) throw err;});
	
				var persistenceColl=db.collection(persistenceCollection);
				var obj={};
				persistenceColl.save(obj,function(){
					var TestWorker=new WorkerDaemon({task_collection:taskCollection,
						audit_collection:auditColl
						});
					TestWorker.start();
					taskColl=db.collection(taskCollection);

					tasks.forEach(function(task){
						console.log("Creating task "+task.label);
						TestWorker.TaskManager.create(task,function(){
							
							task.persistence._id=obj._id;
							TestWorker.TaskManager.assign(task,null,function(){
								console.log("Assigned "+task.label);
							});
						});
					});
				});
			});
		});
});
