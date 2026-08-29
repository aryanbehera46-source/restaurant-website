const path=require("path"),os=require("os"),fs=require("fs");
process.env.ADMIN_PASSWORD="local-test-password";
process.env.JWT_SECRET="local-final-qa-secret-that-is-at-least-thirty-two-characters";
process.env.DB_PATH=path.join(os.tmpdir(),`royal-table-final-qa-${Date.now()}.db`);
process.env.PORT="5053";
process.env.EMAIL_USER="";process.env.EMAIL_PASS="";process.env.GMAIL_USER="";process.env.GMAIL_APP_PASSWORD="";
require("./server");
const db=require("./database");
const base="http://127.0.0.1:5053";
async function request(route,options={}){const response=await fetch(base+route,{...options,headers:{"Content-Type":"application/json",...(options.token?{Authorization:`Bearer ${options.token}`}:{}) ,...(options.headers||{})}});const text=await response.text();let body={};try{body=JSON.parse(text)}catch{body={text}}return{status:response.status,body,headers:response.headers}}
function ok(value,message){if(!value)throw new Error(message)}
const scenarios=[
 {name:"Aarav Mehta",guests:2,time:"12:30",orders:1,status:"new",discount:0,tax:5,service:0,paid:0,method:null},
 {name:"Ishita Rao",guests:4,time:"13:00",orders:2,status:"accepted",discount:5,tax:5,service:5,paid:.45,method:"upi"},
 {name:"Kabir Singh",guests:6,time:"13:30",orders:1,status:"preparing",discount:10,tax:12,service:5,paid:1,method:"card"},
 {name:"Meera Iyer",guests:3,time:"18:00",orders:2,status:"ready",discount:0,tax:5,service:10,paid:0,method:null},
 {name:"Rohan Das",guests:8,time:"18:30",orders:1,status:"served",discount:15,tax:12,service:10,paid:1,method:"cash"},
 {name:"Sara Khan",guests:5,time:"19:00",orders:2,status:"new",discount:7.5,tax:5,service:5,paid:.5,method:"other"},
 {name:"Vihaan Bose",guests:10,time:"19:30",orders:1,status:"accepted",discount:0,tax:12,service:10,paid:1,method:"upi"},
 {name:"Anaya Patel",guests:1,time:"20:00",orders:1,status:"preparing",discount:5,tax:5,service:0,paid:0,method:null},
 {name:"Dev Malhotra",guests:7,time:"20:30",orders:2,status:"ready",discount:12.5,tax:12,service:5,paid:.25,method:"card"},
 {name:"Naina Roy",guests:12,time:"21:00",orders:1,status:"served",discount:0,tax:5,service:10,paid:1,method:"cash"}
];
async function run(){
 const login=await request("/admin/login",{method:"POST",body:JSON.stringify({username:"admin",password:process.env.ADMIN_PASSWORD})});ok(login.status===200&&login.body.token,"Admin login failed");const admin=login.body.token;
 ok((await request("/reservations",{})).status===401,"Reservations exposed without authentication");
 ok((await request("/analytics/orders?date=2026-09-02",{})).status===401,"Analytics exposed without authentication");
 const cors=await request("/menu",{headers:{Origin:"https://malicious.example"}});ok(cors.status===403,"Unapproved CORS origin accepted");
 const item=await request("/menu",{method:"POST",token:admin,body:JSON.stringify({name:"Final QA Tasting Platter",category:"Chef Special",description:"Local QA only",price:480,available:true})});ok(item.status===201,"QA menu item creation failed");const menuItemId=item.body.menuItem.id;
 let createdOrders=0;const statusCounts={new:0,accepted:0,preparing:0,ready:0,served:0};
 for(let i=0;i<scenarios.length;i++){
  const s=scenarios[i],payload={name:s.name,email:`qa-final-${i}@example.invalid`,phone:`90000000${String(i).padStart(2,"0")}`,date:"2026-09-02",time:s.time,guests:s.guests,specialRequest:i%2?"Allergy note confirmed at table":"Quiet seating if available"};let rid;
  if(i<5){const reservation=await request("/reservations",{method:"POST",body:JSON.stringify(payload)});ok(reservation.status===201,`Scenario ${i+1}: reservation failed`);rid=reservation.body.reservationId}
  else{rid=Number(db.prepare("INSERT INTO reservations (name,email,date,time,guests,phone,specialRequest) VALUES (?,?,?,?,?,?,?)").run(payload.name,payload.email,payload.date,payload.time,payload.guests,payload.phone,payload.specialRequest).lastInsertRowid)}
  for(let n=0;n<s.orders;n++){
   const made=await request(`/reservations/${rid}/orders`,{method:"POST",token:admin,body:JSON.stringify({items:[{menuItemId,quantity:(i+n)%3+1,unitPrice:1,notes:n?"Second course":"Medium spice"}],notes:`Controlled QA scenario ${i+1}`})});ok(made.status===201&&made.body.order.items[0].unitPrice===480,`Scenario ${i+1}: authoritative order pricing failed`);createdOrders++;const oid=made.body.order.id;
   const billed=await request(`/orders/${oid}/billing`,{method:"PUT",token:admin,body:JSON.stringify({discountPercent:s.discount,taxRate:s.tax,serviceChargeRate:s.service,grandTotal:1})});ok(billed.status===200&&billed.body.order.grandTotal!==1,`Scenario ${i+1}: billing protection failed`);
   await request(`/orders/${oid}/submit`,{method:"POST",token:admin,body:"{}"});let current="new";for(const next of ["accepted","preparing","ready","served"]){if(current===s.status)break;const moved=await request(`/kitchen/orders/${oid}/status`,{method:"PUT",token:admin,body:JSON.stringify({status:next})});ok(moved.status===200,`Scenario ${i+1}: KOT transition to ${next} failed`);current=next}
   statusCounts[current]++;
   const total=billed.body.order.grandTotal,amount=s.paid===1?total:Number((total*s.paid).toFixed(2));const payment=await request(`/orders/${oid}/payment`,{method:"PUT",token:admin,body:JSON.stringify({amountPaid:amount,paymentMethod:s.method})});ok(payment.status===200,`Scenario ${i+1}: payment failed`);const expected=amount===0?"unpaid":amount===total?"paid":"partially_paid";ok(payment.body.order.paymentStatus===expected,`Scenario ${i+1}: payment state mismatch`);
  }
 }
 ok((await request("/reservations",{method:"POST",body:JSON.stringify({...scenarios[0],email:"rate-limit@example.invalid",phone:"9999999999",date:"2026-09-03",time:"12:00"})})).status===429,"Reservation rate limit did not protect the public endpoint");
 ok(createdOrders===14,"Expected 14 orders across 10 reservations");ok(Object.values(statusCounts).every(n=>n>0),"KOT matrix did not cover every status");
 const kitchen=await request("/kitchen/orders?date=2026-09-02",{token:admin});ok(kitchen.status===200&&kitchen.body.orders.length===14,"Kitchen listing count mismatch");
 const analytics=await request("/analytics/orders?date=2026-09-02",{token:admin});ok(analytics.status===200&&analytics.body.analytics.ordersToday===14&&analytics.body.analytics.billedRevenue>analytics.body.analytics.paidRevenue,"Analytics totals failed");
 const menu=await request("/menu");ok(menu.status===200&&menu.body.menu.some(row=>row.name==="Final QA Tasting Platter"),"QA menu item was not persisted in the isolated database");
 const uiFiles=["../index.html","../admin.html","../staff.html","../chef.html"].map(file=>fs.readFileSync(path.join(__dirname,file),"utf8"));ok(uiFiles.every(html=>html.includes("ui.js")&&html.includes("ui.css")),"Shared UI layer missing from a major page");ok(uiFiles.every(html=>!html.includes("theme-switcher")),"Theme control remained on a major page");
 const mappings=(uiFiles[1].match(/"[^"]+": "assets\/menu\//g)||[]).length;ok(mappings===50,"Admin does not contain 50 menu image mappings");
 console.log("Final hardening 10-order matrix: PASS");console.log(JSON.stringify({reservations:10,orders:createdOrders,kotStatusCounts:statusCounts,paymentCoverage:["unpaid","partially_paid","paid"],methods:["cash","card","upi","other"],productionPollution:0},null,2));process.exit(0);
}
setTimeout(()=>run().catch(error=>{console.error(error);process.exit(1)}),250);
