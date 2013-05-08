var express = require('express');
var tasks=require("./main.js");
var app = express();


var db=require('mongoskin').db(process.env.MONGO_URI,{safe:true});

console.log(process.env.MONGO_URI+":"+db.collectionNames(function(err,d){if (err) throw err; else console.log(d);}));

var collectionName="tasks_test_express_js";
 db.dropCollection(collectionName,function(err){
  if (err){}
});
 
 db.createCollection(collectionName, {capped:true, size:10000,max:1000, w:1},function(err, cb){
 	if (err) throw err;
 	var coll=db.collection(collectionName);
	//at least one record is required, otherwise the tailable cursor doesn't work
 	coll.save({},function(err){if (err) throw err;});

	app.use("/api/tasks",tasks.express({
			mongo_uri:process.env.MONGO_URI,
			mongo_collection:collectionName
		})
	);

});

app.listen(8080);
console.log("Task api started on port 8080 at /api/tasks hitting collection "+collectionName);
