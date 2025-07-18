import { NextRequest, NextResponse } from 'next/server'
import { 
  getAllUsers, 
  updateUserStatus, 
  updateUserAccessCodePermission,
  updateUserPermissions 
} from '@/lib/db/admin'
import { checkUserPermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminUserId = searchParams.get('adminUserId')
    const includeStats = searchParams.get('includeStats') === 'true'
    const role = searchParams.get('role') as 'ADMIN' | 'USER' | 'GUEST' | null
    const isActive = searchParams.get('isActive')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!adminUserId) {
      return NextResponse.json(
        { error: 'adminUserId is required' },
        { status: 400 }
      )
    }

    // 检查管理员权限
    const hasPermission = await checkUserPermission(adminUserId, 'admin_panel')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const users = await getAllUsers({
      includeStats,
      role: role || undefined,
      isActive: isActive !== null ? isActive === 'true' : undefined,
      limit,
      offset,
    })

    return NextResponse.json(users)

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, username, email, password, role = 'USER' } = data

    if (!adminUserId || !username) {
      return NextResponse.json(
        { error: 'adminUserId and username are required' },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // 检查管理员权限
    const hasPermission = await checkUserPermission(adminUserId, 'admin_panel')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // 检查用户名是否已存在
    const { prisma } = await import('@/lib/prisma')
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { 
            username: {
              equals: username,
              mode: 'insensitive' // 不区分大小写
            }
          },
          ...(email ? [{ email }] : []),
        ],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '用户名或邮箱已存在' },
        { status: 400 }
      )
    }

    // 哈希密码
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        isActive: true,
      },
    })

    // 创建用户设置
    await prisma.userSettings.create({
      data: {
        userId: user.id,
        theme: 'light',
        language: 'zh-CN',
        enableMarkdown: true,
        enableLatex: true,
        enableCodeHighlight: true,
        messagePageSize: 50,
      },
    })

    // 为非管理员用户创建权限配置
    if (role !== 'ADMIN') {
      await prisma.userPermission.create({
        data: {
          userId: user.id,
          allowedModelIds: null, // 默认可以使用所有模型
          tokenLimit: null, // 默认无限制
          canShareAccess: true,
          isActive: true,
        },
      })
    }

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, userId, action, ...updateData } = data

    if (!adminUserId || !userId || !action) {
      return NextResponse.json(
        { error: 'adminUserId, userId, and action are required' },
        { status: 400 }
      )
    }

    // 检查管理员权限
    const hasPermission = await checkUserPermission(adminUserId, 'admin_panel')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    let result
    switch (action) {
      case 'updateStatus':
        // 防止管理员封禁自己
        if (adminUserId === userId && !updateData.isActive) {
          return NextResponse.json(
            { error: 'Cannot ban your own account' },
            { status: 400 }
          )
        }
        result = await updateUserStatus(userId, updateData.isActive)
        break
      
      case 'updateAccessCodePermission':
        result = await updateUserAccessCodePermission(userId, updateData.canShareAccessCode)
        break
      
      case 'updatePermissions':
        result = await updateUserPermissions(userId, updateData)
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, userId } = data

    if (!adminUserId || !userId) {
      return NextResponse.json(
        { error: 'adminUserId and userId are required' },
        { status: 400 }
      )
    }

    // 检查管理员权限
    const hasPermission = await checkUserPermission(adminUserId, 'admin_panel')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // 防止删除自己
    if (adminUserId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // 检查要删除的用户是否存在
    const { prisma } = await import('@/lib/prisma')
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 删除用户（硬删除，包括相关数据）
    await prisma.$transaction(async (tx) => {
      // 删除用户的聊天记录
      await tx.message.deleteMany({
        where: { userId }
      })

      // 删除用户的对话
      await tx.conversation.deleteMany({
        where: { userId }
      })

      // 删除用户的Token使用记录
      await tx.tokenUsage.deleteMany({
        where: { userId }
      })

      // 删除用户的权限
      await tx.userPermission.deleteMany({
        where: { userId }
      })

      // 删除用户生成的邀请码
      await tx.inviteCode.deleteMany({
        where: { createdBy: userId }
      })

      // 删除用户生成的访问码
      await tx.accessCode.deleteMany({
        where: { createdBy: userId }
      })

      // 最后删除用户
      await tx.user.delete({
        where: { id: userId }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
