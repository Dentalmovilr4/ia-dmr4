
const os=require('os');
function cpu(){const c=os.cpus();let i=0,t=0;c.forEach(x=>{for(let k in x.times){t+=x.times[k]}i+=x.times.idle});return Math.round(100-(i/t)*100);}
function ram(){const t=os.totalmem(),f=os.freemem();return Math.round(((t-f)/t)*100);}
module.exports={cpu,ram};
