// var path=require('path')
var $=require("jquery");
// var index2=require('./index2.js');
// console.log(index2);

$(function(){
    //站站长
    $('.test').text('16634')
    return;
})


asyncFN();
async function asyncFN(){
    var str= await test();
    console.log(str)
}
function test(){ 
    return new Promise((resolve,reject)=>{
        resolve('99')
    })
}
