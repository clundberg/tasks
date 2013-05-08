/* Defines mongo connection information */
var db=null;

var common_mongo=require("./mongo-common.js");
var mongoskin=require('mongoskin');

for (i in common_mongo){exports[i]=common_mongo[i];}


exports.getDB=function(){
	if (db==null){
		db=require('mongoskin').db(process.env.MONGOLAB_URI || 'mongodb://localhost:27017/frakture',{safe:true});
	}
	return db;
}

exports.getObjectID=function(v){
//	console.log(v);	console.log(require('mongoskin').ObjectID.createFromHexString(v));
	return (typeof v=='string')?mongoskin.ObjectID.createFromHexString(v):v;
}

exports.convertOid=function(o){
	if (typeof o!='object') return o;
	for (i in o){
		if (typeof o[i]=='object' && o[i]["$oid"]){ o[i]=mongoskin.ObjectID.createFromHexString(o[i]["$oid"]);
		}else{ o[i]=exports.convertOid(o[i]);}
	}
	return o;
}


//This function inserts a new document with an incremental key
exports.insertIncrementalDocument=function(doc, targetCollection,callback) {
        targetCollection.find( {}, { _id: 1 }).sort({ _id: -1}).limit(1).toArray(function(err,arr){
        	if (err) throw err;
        	if (arr[0] && Number(arr[0]._id)!=arr[0]._id) throw new Error("Collection '"+targetCollection.collectionName+"' has non-numerical entries.  Cannot insert an incremental document.");
			var seq = (arr && arr[0]) ? arr[0]._id + 1 : 1;
			doc._id = seq;

			targetCollection.insert(doc,{safe:true},function(err,results){
				if( err && err.code ) {
					if( err.code == 11000 /* dup key */ ){
						//try again
						exports.insertIncrementalDocument(doc,targetCollection,callback);
						return;
					}else{
						throw new Error("unexpected error inserting data: " + JSON.stringify( err )) ;
					}
				}
				callback();
			});
		});
}


