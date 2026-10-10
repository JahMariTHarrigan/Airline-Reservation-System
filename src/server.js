import express from 'express';
import helmet from 'helmet';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {pool,query,transaction} from './db.js';
import {token,digest,hash,verify} from './security.js';
import {adminRoutes} from './admin.js';
export const app=express();
app.disable('x-powered-by');app.use(helmet());app.use(express.json({limit:'32kb'}));
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(x,max=80)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const int=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
app.use('/api',async(req,res,next)=>{res.set('Cache-Control','no-store');try{const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('skyline='))?.slice(8);if(cookie){const rows=await query('SELECT s.*,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()',[digest(cookie)]);req.session=rows[0];}next();}catch(e){next(e);}});
function auth(req,res,next){if(!req.session)return next(error('Please log in.',401));next();}
function admin(req,res,next){if(req.session?.role!=='admin')return next(error('Administrator access required.',403));next();}
function csrf(req,res,next){if(req.headers['x-csrf-token']!==req.session?.csrf_token)return next(error('Session verification failed. Reload and try again.',403));next();}
app.get('/api/session',(req,res)=>res.json(req.session?{user:{id:req.session.user_id,name:req.session.name,email:req.session.email,role:req.session.role},csrf:req.session.csrf_token}:{user:null}));
app.post('/api/register',async(req,res)=>{const {name,email,password}=req.body;if(!text(name)||!text(email,200)||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)throw error('Enter a name, valid email and password of 12 to 128 characters.');await query('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)',[name.trim(),email.trim().toLowerCase(),await hash(password)]);res.status(201).json({message:'Account created. Please log in.'});});
app.post('/api/login',async(req,res)=>{const {email,password}=req.body;if(!text(email,200)||typeof password!=='string'||password.length>128)throw error('Invalid email or password.',401);const users=await query('SELECT * FROM users WHERE email=?',[email.trim().toLowerCase()]);if(!users[0]||!await verify(password,users[0].password_hash))throw error('Invalid email or password.',401);const t=token(),c=token();await query('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[digest(t),users[0].id,c]);res.cookie('skyline',t,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*3600000,path:'/'}).json({message:'Signed in.'});});
app.post('/api/logout',auth,csrf,async(req,res)=>{await query('DELETE FROM sessions WHERE token_hash=?',[req.session.token_hash]);res.clearCookie('skyline',{path:'/'}).json({message:'Signed out.'});});
app.get('/api/airports',async(req,res)=>res.json(await query('SELECT * FROM airports ORDER BY city')));
const flightSQL=`SELECT i.*,f.number,f.origin,f.destination,a.model,
 (SELECT COUNT(*) FROM seats s WHERE s.aircraft_id=i.aircraft_id) capacity,
 (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.instance_id=i.id AND sa.released_at IS NULL) occupied
 FROM flight_instances i JOIN flights f ON f.id=i.flight_id JOIN aircraft a ON a.id=i.aircraft_id`;
app.get('/api/flights',async(req,res)=>{const {origin,destination,date}=req.query;if(!/^[A-Z]{3}$/.test(origin)||!/^[A-Z]{3}$/.test(destination)||origin===destination||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw error('Choose different airports and a valid departure date.');res.json(await query(flightSQL+' WHERE f.origin=? AND f.destination=? AND DATE(i.departure)=? AND i.departure>UTC_TIMESTAMP() AND i.status=? ORDER BY i.departure',[origin,destination,date,'scheduled']));});
app.get('/api/flights/:id',async(req,res)=>{const rows=await query(flightSQL+' WHERE i.id=?',[req.params.id]);if(!rows[0])throw error('Flight not found.',404);const seats=await query('SELECT s.id,s.label,EXISTS(SELECT 1 FROM seat_assignments sa WHERE sa.seat_id=s.id AND sa.instance_id=? AND sa.released_at IS NULL) occupied FROM seats s WHERE s.aircraft_id=? ORDER BY s.id',[rows[0].id,rows[0].aircraft_id]);res.json({...rows[0],seats});});
app.post('/api/bookings',auth,csrf,async(req,res)=>{
 const {instance_id,passengers}=req.body;
 if(!int(instance_id)||!Array.isArray(passengers)||passengers.length<1||passengers.length>4||passengers.some(p=>!p||!text(p.name)||!int(p.seat_id))||new Set(passengers.map(p=>Number(p.seat_id))).size!==passengers.length)throw error('Enter one to four passenger names and different valid seats.');
 const booking=await transaction(async c=>{
  const [[flight]]=await c.execute('SELECT * FROM flight_instances WHERE id=? AND departure>UTC_TIMESTAMP() AND status=? FOR UPDATE',[instance_id,'scheduled']);if(!flight)throw error('This departure is unavailable.');
  const reference=randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
  const [b]=await c.execute('INSERT INTO bookings(reference,user_id,instance_id,unit_fare_cents,total_cents) VALUES (?,?,?,?,?)',[reference,req.session.user_id,flight.id,flight.fare_cents,flight.fare_cents*passengers.length]);
  for(const p of passengers){const [[seat]]=await c.execute('SELECT id FROM seats WHERE id=? AND aircraft_id=?',[p.seat_id,flight.aircraft_id]);if(!seat)throw error('Choose a seat on this aircraft.');const [person]=await c.execute('INSERT INTO passengers(name) VALUES (?)',[p.name.trim()]);await c.execute('INSERT INTO booking_passengers VALUES (?,?)',[b.insertId,person.insertId]);await c.execute('INSERT INTO seat_assignments(booking_id,passenger_id,instance_id,aircraft_id,seat_id) VALUES (?,?,?,?,?)',[b.insertId,person.insertId,flight.id,flight.aircraft_id,p.seat_id]);}
  await c.execute('INSERT INTO payments(booking_id,amount_cents,status) VALUES (?,?,?)',[b.insertId,flight.fare_cents*passengers.length,'simulated']);return {reference,total_cents:flight.fare_cents*passengers.length};
 });res.status(201).json(booking);
});
const bookingSQL=`SELECT b.*,f.number,f.origin,f.destination,i.departure,i.arrival FROM bookings b JOIN flight_instances i ON i.id=b.instance_id JOIN flights f ON f.id=i.flight_id`;
app.get('/api/bookings',auth,async(req,res)=>{const rows=await query(bookingSQL+' WHERE b.user_id=?'+(req.query.reference?' AND b.reference=?':'')+' ORDER BY b.created_at DESC',[req.session.user_id,...(req.query.reference?[String(req.query.reference).trim().toUpperCase()]:[])]);for(const b of rows)b.passengers=await query('SELECT p.name,s.label FROM booking_passengers bp JOIN passengers p ON p.id=bp.passenger_id JOIN seat_assignments sa ON sa.booking_id=bp.booking_id AND sa.passenger_id=bp.passenger_id JOIN seats s ON s.id=sa.seat_id WHERE bp.booking_id=?',[b.id]);res.json(rows);});
export async function cancelBooking(id,user,administrator=false){return transaction(async c=>{const [[b]]=await c.execute('SELECT * FROM bookings WHERE id=?'+(administrator?'':' AND user_id=?')+' FOR UPDATE',[id,...(administrator?[]:[user])]);if(!b)throw error('Booking not found.',404);await c.execute('UPDATE bookings SET status=?,cancelled_at=COALESCE(cancelled_at,UTC_TIMESTAMP()) WHERE id=?',['cancelled',id]);await c.execute('UPDATE seat_assignments SET released_at=COALESCE(released_at,UTC_TIMESTAMP()) WHERE booking_id=?',[id]);await c.execute('UPDATE payments SET status=? WHERE booking_id=?',['voided',id]);});}
app.post('/api/bookings/:id/cancel',auth,csrf,async(req,res)=>{await cancelBooking(req.params.id,req.session.user_id);res.json({message:'Booking cancelled. Seats released; simulated payment voided.'});});
app.use('/api/admin',auth,adminRoutes);
app.post('/api/admin/reservations/:id/cancel',auth,admin,csrf,async(req,res)=>{await cancelBooking(req.params.id,req.session.user_id,true);res.json({message:'Reservation cancelled.'});});
app.get('/api/health',async(req,res)=>{await query('SELECT 1');res.json({status:'ok',version:'beta',database:'MySQL'});});
app.use(express.static(fileURLToPath(new URL('../public/',import.meta.url))));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const duplicate=err.code==='ER_DUP_ENTRY';const message=duplicate?'That email or seat is already in use. Refresh availability and try again.':err.status?err.message:'The request could not be completed.';if(!err.status&&!duplicate)console.error(err.code||err.message);res.status(duplicate?409:err.status||500).json({error:message});});
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=app.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Skyline Air at http://127.0.0.1:'+(process.env.PORT||3000)));process.on('SIGTERM',()=>server.close(()=>pool.end()));}
