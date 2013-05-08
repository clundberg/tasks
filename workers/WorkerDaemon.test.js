var WorkerDaemon=require("./WorkerDaemon.js"),
	db=require('mongoskin').db(process.env.MONGOLAB_URI,{safe:true});
	
var tasks=[
{
	label:"Create code",
	assignee:{
		library:"workers/CommonTaskWorker.js",
		method:"extendContext"
	},
	context_id:"codes",
	options:{campaign_code:"2013-04-01"}
},
{label:"Create TAF",  context_id:"taf", 
	assignee:{
		library:"workers/dummy/DummyMessage.js", 
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
{label:"Create Email", context_id:"email1", 
	assignee:{
		library:"workers/dummy/DummyMessage.js",
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
	 {label:"Publish TAF",context_id:"email1", 
		assignee:{
			library:"workers/dummy/DummyMessage.js",
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
var collectionName="worker_daemon_test_tasks";

//at least one record is required, otherwise the tailable cursor doesn't work
var coll=db.collection(collectionName);

var TestWorker=new WorkerDaemon({collection:coll});
TestWorker.start();

tasks.forEach(function(task){
	coll.save(task,function(err){
		if (err) throw err;
	});
});

