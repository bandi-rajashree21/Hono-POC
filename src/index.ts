import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client/edge'

type Bindings = {
  DATABASE_URL: string
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
      'DELETE /api/users/:id': 'Delete user'
    }
  })
})

app.post('/api/users', async (c) => {
  try {
    const accelerateUrl = c.env.DATABASE_URL
    const prisma = getPrisma(accelerateUrl)
    
    const body = await c.req.json()
    
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
    const body = await c.req.json()
    
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

export default app