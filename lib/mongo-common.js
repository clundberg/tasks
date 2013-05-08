/*
Library to support operations for Mongo, in both client and server side
*/
if (typeof Frakture =='undefined') Frakture={};
Frakture.Mongo=Frakture.Mongo || {};

Frakture.Mongo.escapeDollarSign=function(o){
	if (!o) return null;
	switch (typeof o){
		case 'object':	
			for (var i in o){
				if ((typeof i=='string') && i.indexOf('$')==0){
					o['_'+i]=exports.escapeDollarSign(o[i]);
					delete o[i];
				}else{
					o[i]=exports.escapeDollarSign(o[i]);
				}
			}
		default:	return o;
	}
}

Frakture.Mongo.unescapeDollarSign=function(o){
	if (!o) return null;
	switch (typeof o){
		case 'object':	
			for (var i in o){
				if ((typeof i=='string') && i.indexOf('_$')==0){
					o[i.substring(1)]=exports.unescapeDollarSign(o[i]);
					delete o[i];
				}else{
					o[i]=exports.unescapeDollarSign(o[i]);
				}
			}
		default:	return o;
	}
}

if (typeof exports == 'object' && exports){
	for (i in Frakture.Mongo){exports[i]=Frakture.Mongo[i];}}