
// JSpec - Core
// Copyright 2008 - 2009 TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)

var JSpec = {
  
  version : '0.2.2',
  suites  : {},
  stats   : { specs : 0, assertions : 0, failures : 0, passes : 0 },
  
  // --- Matchers
  
  matchers : {
    eql             : '==',
    be              : 'alias eql',
    equal           : '===',
    be_greater_than : '>',
    be_less_than    : '<',
    be_at_least     : '>=',
    be_at_most      : '<=',
    be_a            : 'actual.constructor == expected',
    be_an           : 'alias be_a',
    be_empty        : 'actual.length == 0',
    be_true         : 'actual == true',
    be_false        : 'actual == false',
    be_type         : 'typeof actual == expected',
    match           : 'actual.match(expected)',
    have_length_of  : 'actual.length == expected',
    respond_to      : 'typeof actual[expected] == "function"',
    
    include : { match : function(expected, actual) {
      if (actual.constructor == String) return actual.match(expected)
      else return expected in actual
    }},
    
    throw_error : { match : function(expected, actual) {
      try { actual() }
      catch (e) { return true }
    }}
  },
  
  // --- Objects
  
  /**
   * Default context in which bodies are evaluated.
   * This allows specs and hooks to use the 'this' keyword in
   * order to store variables, as well as allowing the Context
   * to provide helper methods or properties.
   *
   * Replace context simply by setting JSpec.context
   * to your own like below:
   *
   * JSpec.context = { foo : 'bar' }
   * JSpec.context = new CustomContext
   *
   * Contexts can be changed within any body, this can be useful
   * in order to provide specific helper methods to specific suites.
   */
  
  Context : function() {

  },
  
  // TODO: allow several arguments to be passed, always consider actual array / apply
  // TODO: change include to allow several like should_include(1,2,3)
  
  /**
   * Matcher.
   * 
   * There are many ways to define a matcher within JSpec. The first being
   * a string that is less than 4 characters long, which is considered a simple
   * binary operation between two expressions. For example the matcher '==' simply
   * evaluates to 'actual == expected'.
   *
   * The second way to create a matcher is with a larger string, which is evaluated,
   * and then returned such as 'actual.match(expected)'.
   *
   * You may alias simply by starting a string with 'alias', such as 'be' : 'alias eql'.
   *
   * Finally an object may be used, and must contain a 'match' method, which is passed
   * both the expected, and actual values. Optionally a 'message' method may be used to
   * specify a custom message. Example:
   *
   * match : function(expected, actual) {
   *   return typeof actual == expected
   * }
   *
   * @param  {string} name
   * @param  {hash, string} matcher
   * @param  {object} expected
   * @param  {object} actual
   * @param  {bool} negate
   * @return {Matcher}
   */
  
  Matcher : function (name, matcher, expected, actual, negate) {
    var self = this
    this.name = name, this.message = '', this.passed = false
    
    if (typeof matcher == 'string') {
      if (matcher.match(/^alias (\w+)/)) matcher = JSpec.matchers[matcher.match(/^alias (\w+)/)[1]]
      if (matcher.length < 4) body = 'actual ' + matcher + ' expected'
      else body = matcher
      matcher = { match : function(expected, actual) { return eval(body) } }
    }
    
    function generateMessage() {
      return 'expected ' + actual + ' to ' + (negate ? ' not ' : '') + name.replace(/_/g, ' ') + ' ' + expected
    }
    
    function setMessage() {
      if (typeof matcher.message == 'function')
        self.message = matcher.message(expected, actual, negate)
      else
        self.message = generateMessage()
    }

    function pass() {
      setMessage()
      JSpec.stats.passes += 1
      self.passed = true
    }

    function fail() {
      setMessage()
      JSpec.stats.failures += 1
    }

    this.match = function() {
      expected = expected == null ? null : expected.valueOf()
      return matcher.match.call(JSpec, expected, actual.valueOf())
    }

    this.passes = function() {
      return negate? !this.match() : this.match()
    }

    this.exec = function() {
      if (this.passes()) pass()
      else fail()

      return this
    }
  },
      
  /**
   * Default formatter, outputting to the DOM.
   */
  
  Formatter : function(results) {
    var markup = '', report = document.getElementById('jspec')
    if (!report) throw 'JSpec requires div#jspec to output its reports'

    markup += 
      '<div id="JSpec-report"><div class="heading">' +
      '<span class="passes">Passes: <em>' + results.stats.passes + '</em></span> ' +
      '<span class="failures">Failures: <em>' + results.stats.failures + '</em></span>' +
      '</div><div class="suites">'
    
    results.each(results.suites, function(description, suite){
      if (suite.ran) {
        markup += '<h2>' + description + '</h2>'
        results.each(suite.specs, function(spec){
          var assertionCount = ' (<span class="assertion-count">' + spec.assertions.length + '</span>)'
          if (spec.requiresImplementation()) markup += '<p class="requires-implementation">' + spec.description + '</p>'
          else if (spec.passed()) markup += '<p class="pass">' + spec.description + assertionCount + '</p>'
          else markup += '<p class="fail">' + spec.description + assertionCount + ' <em>' + spec.failure().message + '</em>' + '</p>' 
        })
      }
    })

    markup += '</div></div>'

    report.innerHTML = markup
  },
      
  /**
   * Specification Suite block object.
   *
   * @param {string} description
   */
      
  Suite : function(description) {
    this.specs = [], this.hooks = {}, this.description = description, this.ran = false
    this.addSpec = function(spec) {
      this.specs.push(spec)
      spec.suite = this
    }
    
    this.hook = function(hook) {
      if (body = this.hooks[hook]) 
        JSpec.evalBody(body, "Error in hook '" + hook + "', suite '" + this.description + "'")  
    }
  },
  
  /**
   * Specification block object.
   *
   * @param {string} description
   * @param {string} body
   */
  
  Spec : function(description, body) {
    this.body = body, this.description = description, this.assertions = []
    
    this.failure = function() {
      var failure
      JSpec.each(this.assertions, function(assertion){
        if (!assertion.passed && !failure) failure = assertion
      })
      return failure
    }
        
    this.passed = function() {
      return !this.failure()
    }
    
    this.requiresImplementation = function() {
      return this.assertions.length == 0
    }
  },
  
  // --- Methods
  
  /**
   * Iterate an object, invoking the given callback.
   *
   * @param  {hash, array} object
   * @param  {function} callback
   * @return {Type}
   */
  
  each : function(object, callback) {
    for (var key in object) {
      if (typeof object[key] == 'function') continue
      if (callback.length == 1)
        callback.call(this, object[key])
      else
        callback.call(this, key, object[key])
    }
    return this
  },
  
  /**
   * Define matchers.
   *
   * @param  {hash} matchers
   * @return {JSpec}
   */
  
  addMatchers : function(matchers) {
    this.each(matchers, function(key, callbacks){
      Object.prototype['should_' + key] = function(other) {
        var matcher = new JSpec.Matcher(key, matchers[key], other, this)
        JSpec.currentSpec.assertions.push(matcher.exec())
      }
      Object.prototype['should_not_' + key] = function(other) {
        var matcher = new JSpec.Matcher(key, matchers[key], other, this, true)
        JSpec.currentSpec.assertions.push(matcher.exec())
      }
    })
    return this
  },
  
  /**
   * Report on the results.
   *
   * @return {JSpec}
   */
  
  report : function() {
    var formatter = new JSpec.Formatter(this)
    return this
  },
  
  /**
   * Run the spec suites.
   *
   * @return {JSpec}
   */
  
  run : function() {
    this.each(this.suites, function(suite) {
      this.runSuite(suite)
    })
    return this
  },
  
  /**
   * Run a suite.
   *
   * @param  {Suite}  suite
   * @return {JSpec}
   */
  
  runSuite : function(suite) {
    suite.ran = true
    suite.hook('before')
    this.each(suite.specs, function(spec) {
      suite.hook('before_each')
      this.currentSpec = spec
      this.stats.specs += 1
      this.evalBody(spec.body, "Error in spec '" + spec.description + "': ")
      this.stats.assertions += spec.assertions.length
      suite.hook('after_each')
    })
    suite.hook('after')
    return this
  },
  
  /**
   * Evaluate a JSpec capture body.
   *
   * @param  {string} body
   * @param  {string} errorMessage (optional)
   * @return {Type}
   */
  
  evalBody : function(body, errorMessage) {
    try {
      var runner = function() { eval(JSpec.preProcessBody(body)) }
      this.context = this.context || new JSpec.Context
      runner.call(this.context)
    } 
    catch(e) { throw (errorMessage || 'Error: ') + e }
  },
  
  /**
   * Pre-process capture body.
   *
   * - Allow optional parents like should_be_true
   *
   * @param  {string} body
   * @return {Type}
   */
  
  preProcessBody : function(body) {
    body = body.replace(/\.should_(\w+)(?: |$)(.*)$/gm, '.should_$1($2)')
    return body
  },
  
  /**
   * Evaluate a string of JSpec.
   *
   * @param  {string} input
   * @return {JSpec}
   */
  
  eval : function(input) {
    return this.parse(input)
  },
  
  /**
   * Parse a string.
   *
   * @param  {string} input
   * @return {JSpec}
   */
   
  parse : function(input) {
    var describing, specing, capturing
    var token, describe, spec, capture, body = []
    var tokens = this.tokenize(input)
    
    while (tokens.length) {
      token = tokens.shift()
      
      switch (token) {
        case 'end':
          if (describing) this.suites[describe] = this.suites[describe] || new JSpec.Suite(describe)
          if (specing) {
            var newSpec = new JSpec.Spec(spec, body.join(''))
            this.suites[describe].addSpec(newSpec)
            body = [], spec = specing = null
          }
          else if (capturing) {
            var body = body.join('')
            if (describing) this.suites[describe].hooks[capture] = body
            body = [], capturing = capture = null
          }
          else if (describing) {
            describing = describe = null
          }
          break
          
        case 'before':
        case 'after':
        case 'before_each':
        case 'after_each': capturing = true; break
        
        case 'describe': describing = true; break
        case 'it'      : specing = true;    break
        case '__END__' : return this;       break
      }
      
      if (spec || capture) {
        body.push(token)
      }
      else {
        if (capturing) capture = token
        if (/'.*?'/.test(token)) {
          if (specing) spec = token.replace(/'/g, '')
          else if (describing) describe = token.replace(/'/g, '')
        }
      }
    }
    
    return this
  },
  
  /**
   * Tokenize a string.
   *
   * @param  {string} input
   * @return {array}
   */
  
  tokenize : function(input) {
    if (input.constructor == Array) return input
    var regexp = /__END__|end|before_each|after_each|before|after|it|describe|'.*?'|\n|./g
    return input.match(regexp)
  },
  
  /**
   * Load a files contents.
   *
   * @param  {string} file
   * @return {string}
   */
  
  load : function(file) {
    var request = new XMLHttpRequest
    request.open('GET', file, false)
    request.send(null)
    if (request.readyState == 4)
      return request.responseText
  },
  
  /**
   * Evaluate, run, and report on the file passed.
   *
   * @param {string} file
   */
  
  exec : function(file) {
    this.eval(this.load(file)).run().report()
  }
}

JSpec.addMatchers(JSpec.matchers)