console.log("Starting test");
var WorkerDaemon=require("./WorkerDaemon.js"),
	db=require('mongoskin').db(process.env.MONGO_URI,{safe:true}),
	async=require("async");
	
	
var tasks=[
{
	label:"Create code",
	assignee:{
		library:"CommonTaskWorker.js",
		method:"extendContext"
	},
	persistence_property:"codes",
	options:{campaign_code:"2013-04-01"}
},
{label:"Create TAF",  persistence_property:"taf", 
	assignee:{
		library:"dummy/DummyMessage.js", 
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
{label:"Create Email", persistence_property:"email1", 
	assignee:{
		library:"dummy/DummyMessage.js",
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
	 {label:"Publish TAF",persistence_property:"email1", 
		assignee:{
			library:"dummy/DummyMessage.js",
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

var taskCollection="worker_daemon_test_tasks";
var persistenceCollection="worker_daemon_test_persistence";
var auditCollection="worker_daemon_test_audit";

function resetCollection(name,opts,callback){
	 
	 db.collection(name).drop(function(err){
		 db.createCollection(name, opts || {},function(err, cb){
			if (err) throw err;
			callback();
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
					var TestWorker=new WorkerDaemon({task_collection:taskCollection,persistence_collection:persistenceColl,audit_collection:auditColl});
					TestWorker.start();
					taskColl=db.collection(taskCollection);

					tasks.forEach(function(task){
						task.persistence_id=obj._id;
						taskColl.save(task,function(err){
							if (err) throw err;
						});
					});
				});
			});
		});
});

