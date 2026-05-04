
const {exec}=require('child_process');

function ping(host){
  return new Promise(res=>{
    exec('ping -c 1 -W 1 '+host,(e,stdout)=>{
      if(e) return res(999);
      const m=stdout.match(/time=(\d+\.?\d*)/);
      res(m?parseFloat(m[1]):999);
    });
  });
}

module.exports={ping};
