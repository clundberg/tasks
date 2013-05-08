/*
Library 

*/

function routerGenerator(opts){
	if (!opts.mongo_uri){ throw "mongo_uri is a required option";}
	if (!opts.mongo_collection){ throw "mongo_collection is a required option";}
	
	return function(req,res,next){
		if (req.url=="/"){
			res.send(req.url+req.method);
			return;
			switch(req.method){
				case "GET":
					res.send(req.url);
					break;
				case "POST":
					res.send(req.url);
					break;
			}
		}
	}
}

module.exports=routerGenerator;