exports.validateFilename=function(s){
	if (s 
		&& s.match(/^[.a-zA-Z\/_0-9-]+$/)
		&& s.indexOf("..")<0
		){
		return true;
	}
	
	throw "Invalid filename:"+s;
}
