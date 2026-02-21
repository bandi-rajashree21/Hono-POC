import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client/edge'
import { jwt } from 'hono/jwt'
import * as jose from 'jose'

type Bindings = {
  DATABASE_URL: string
  JWT_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

const getPrisma = (accelerateUrl: string) => {
  return new PrismaClient({
    accelerateUrl: accelerateUrl,
  })
}

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    message: 'CRUD API is running!', 
    endpoints: {
      'GET /api/users': 'Get all users',
      'GET /api/users/:id': 'Get user by ID',
      'POST /api/users': 'Create new user',
      'PUT /api/users/:id': 'Update user',
      'DELETE /api/users/:id': 'Delete user',
      'POST /api/login': 'Authenticate user and get JWT token',
      'GET /protected/profile': 'Get authenticated user profile (requires Bearer token)'
    }
  })
})

app.post('/api/users', async (c) => {
  try {
    const accelerateUrl = c.env.DATABASE_URL
    const prisma = getPrisma(accelerateUrl)
    
    let body;
    try {
      body = await c.req.json()
    } catch (jsonError) {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }
    
    // Basic validation
    if (!body.email || !body.name || !body.password) {
      return c.json({ error: 'Missing required fields: email, name, password' }, 400)
    }
    
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        password: body.password // In production, hash this!
      }
    })
    
    return c.json({ success: true, user })
  } catch (error) {
    console.error('Error creating user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 400)
  }
})

// GET all users
app.get('/api/users', async (c) => {
  try {
    const accelerateUrl = c.env.DATABASE_URL
    const prisma = getPrisma(accelerateUrl)
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })
    
    return c.json({ success: true, users })
  } catch (error) {
    console.error('Error fetching users:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 500)
  }
})

// GET user by ID
app.get('/api/users/:id', async (c) => {
  try {
    const accelerateUrl = c.env.DATABASE_URL
    const prisma = getPrisma(accelerateUrl)
    const id = parseInt(c.req.param('id'))
    
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
        // Exclude password for security
      }
    })
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({ success: true, user })
  } catch (error) {
    console.error('Error fetching user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 500)
  }
})

// UPDATE user by ID
app.put('/api/users/:id', async (c) => {
  try {
    const accelerateUrl = c.env.DATABASE_URL
    const prisma = getPrisma(accelerateUrl)
    const id = parseInt(c.req.param('id'))
    
    let body;
    try {
      body = await c.req.json()
    } catch (jsonError) {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }
    
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })
    
    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.email && { email: body.email }),
        ...(body.name && { name: body.name }),
        ...(body.password && { password: body.password }) // In production, hash this!
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })
    
    return c.json({ success: true, user })
  } catch (error) {
    console.error('Error updating user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 400)
  }
})

// DELETE user by ID
app.delete('/api/users/:id', async (c) => {
  try {
    const accelerateUrl = c.env.DATABASE_URL
    const prisma = getPrisma(accelerateUrl)
    const id = parseInt(c.req.param('id'))
    
    if (isNaN(id)) {
      return c.json({ error: 'Invalid user ID' }, 400)
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })
    
    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    await prisma.user.delete({
      where: { id }
    })
    
    return c.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 500)
  }
})

app.post('/api/login', async (c) => {
  try {
    const databaseUrl = c.env.DATABASE_URL
    const prisma = getPrisma(databaseUrl)
    
    let body;
    try {
      body = await c.req.json()
    } catch (jsonError) {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }
    
    if (!body.email || !body.password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }
    
    const user = await prisma.user.findUnique({
      where: { email: body.email }
    })
    
    if (!user || user.password !== body.password) { // Should be hashed!
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    const jwtSecret = c.env.JWT_SECRET || 'my-secret'
    const secret = new TextEncoder().encode(jwtSecret)
    const token = await new jose.SignJWT({ id: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret)
    
    return c.json({ 
      success: true, 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    console.error('Error during login:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 400)
  }
})

app.use("/protected/*", jwt({ secret: "my-secret", alg: "HS256" }));

app.get("/protected/profile", async (c) => {
  try {
    const jwtPayload = c.get("jwtPayload");
    const prisma = getPrisma(c.env.DATABASE_URL)
    
    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: jwtPayload.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({ 
      message: 'Authenticated!', 
      user: user,
      tokenInfo: jwtPayload
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return c.json({ error: errorMessage }, 500)
  }
});

export default app