var xtend = require("xtend"),
    minimatch = require("minimatch");

function generateBuildGraph(inputs, rules) {
  function itr(buckets, operations, outputs) {
    var newOutputs = []; //new outputs

    function glob(pattern) {
      var matches = [];
      outputs.forEach(function(out) {
        if(minimatch(out, pattern))
          matches.push(out);
      });
      return matches;
    }

    rules.forEach(function(rule, i) {
      if(rule.each) newOutputs = newOutputs.concat(checkInput(rule.input, rule, buckets[i], operations, i, glob));
      else newOutputs = newOutputs.concat(checkInputs(rule.inputs, rule, buckets[i], operations, i, glob));
    });
    
    if(newOutputs.length > 0) return itr(buckets, operations, newOutputs);
    else return buckets;
  }

  return edgesToNodeList(mergeBuckets(itr(genObjectArray(rules.length), [], cloneArray(inputs))));
}

function checkInputs(inputs, rule, bucket, operations, i, glob) {
  var outputs = [];

  inputs.forEach(function(input) {
    outputs = outputs.concat(checkInput(input, rule, bucket, operations, i, glob));
  });

  return outputs;
}

function checkInput(input, rule, bucket, operations, i, glob) {
  var outputs = [];
  glob(input).forEach(function(match) {
    if(!bucket[match]) {
      if(rule.each)
        bucket[match] = new Operation(rule.op); 
      else if (!operations[i]) {
        bucket[match] = operations[i] = new Operation(rule.op);
      } else
        bucket[match] = operations[i];

      if(!rule.task) {
        var output = outputForInput(rule, match);
        bucket[match].output = output;

        outputs.push(output);
      }
    }
  });

  return outputs;
}

function edgesToNodeList(edges) {
  var nodes = [];

  function addFile(name, out) {
    if(name instanceof File) {
      for(var i = 0; i < nodes.length; i++) {
        if(nodes[i] instanceof File && nodes[i].file === name.file) {
          if(out) nodes[i].outputs.push(out);
          return nodes[i];
        }
      }

      if(nodes.indexOf(file === -1)) nodes.push(name);
      if(out) name.outputs.push(out);
      return name;
    } else {
      for(var i = 0; i < nodes.length; i++) {
        if(nodes[i] instanceof File && nodes[i].file === name) {
          if(out) nodes[i].outputs.push(out);
          return nodes[i];
        }
      }
      
      var file = new File(name);
      if(out) file.outputs.push(out);
      nodes.push(file);
      return file;
    }
  }

  function addOperation(op) {
    for(var i = 0; i < nodes.length; i++) {
      if(nodes[i]._id === op._id) return op;
    } 

    nodes.push(op);
    return op;
  }

  edges.forEach(function(edge) {
    var input = addFile(edge[0], edge[1]);
    var op = addOperation(edge[1]);
    op.inputs.push(input);
    if(!(edge[1].output instanceof File)) {
      var out = addFile(edge[1].output);
      out.inputs.push(op);
      op.output = out;
    }
  });

  return nodes;
}

function cloneArray(arr) {
  return arr.filter(function(i) { return i; });
}

function outputForInput(rule, input) {
  if(typeof rule.output === "function") 
    return rule.output(input);
  return rule.output;
}

function genObjectArray(n) {
  var arr = [];
  for(; n > 0; n--) arr.push({});
  return arr;
}

function mergeBuckets(objs) {
  return objs.reduce(function(prev, obj) {
    var arr = [];
    for(var input in obj) {
      var output = obj[input];
      arr.push([input, output]);
    }
    return prev.concat(arr);
  }, []);
}

//A unique transformation or task. In the case of `each` rules, many operation
//nodes may exist for a single rule definition.
var opId = 0;
function Operation(fn) {
  this.fn = fn;
  this.inputs = [];
  this.inComplete = 0;
  this._id = opId++;
}

Operation.prototype.isFile = function() {
  return false;
};

function File(file) {
  this.file = file;
  this.outputs = [];
  this.inputs = [];
}

File.prototype.isFile = function() {
  return true;
};

function toArray(arr) {
  if(Array.isArray(arr)) return arr;
  else return [arr];
}

module.exports = generateBuildGraph;
