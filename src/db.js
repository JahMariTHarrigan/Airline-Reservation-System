import mysql from 'mysql2/promise';
export const config={host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'skyline',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'skyline_air',timezone:'Z',dateStrings:true};
if(process.env.DB_SOCKET)config.socketPath=process.env.DB_SOCKET;
export const pool=mysql.createPool({...config,connectionLimit:10});
export async function query(sql,args=[]){const [rows]=await pool.execute(sql,args);return rows;}
export async function transaction(fn){const c=await pool.getConnection();try{await c.beginTransaction();const value=await fn(c);await c.commit();return value;}catch(e){await c.rollback();throw e;}finally{c.release();}}
