import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})


app.post('/api/greet',async(c)=>{
  const body=await c.req.json();
  return c.json({
   message:`Hello ${body.name}!`
  });
})

export default app
