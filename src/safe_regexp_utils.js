module.exports = class SafeRegexpUtils{
  static test(reg, str){
    const result = reg.test(str);
    reg.lastIndex = 0;
    return result;
  }

  static exec(reg, str){
    const result = reg.exec(str);
    reg.lastIndex = 0;
    return result;
  }
}
