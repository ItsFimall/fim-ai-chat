import { NextRequest, NextResponse } from 'next/server'
import { checkUserPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInviteCode } from '@/lib/codes'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminUserId = searchParams.get('adminUserId')
    const type = searchParams.get('type') || 'invite' // 'invite' or 'access'
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

    if (type === 'invite') {
      // 获取邀请码列表
      const inviteCodes = await prisma.inviteCode.findMany({
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })

      return NextResponse.json(inviteCodes)
    } else if (type === 'access') {
      // 获取访问码列表
      const accessCodes = await prisma.accessCode.findMany({
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })

      return NextResponse.json(accessCodes)
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error fetching codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, type, role, maxUses, expiresAt } = data

    if (!adminUserId || !type) {
      return NextResponse.json(
        { error: 'adminUserId and type are required' },
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

    if (type === 'invite') {
      // 创建邀请码
      const code = generateInviteCode()

      const inviteCode = await prisma.inviteCode.create({
        data: {
          code,
          maxUses: maxUses || 1,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: adminUserId,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      })

      return NextResponse.json(inviteCode)
    } else if (type === 'access') {
      // 创建访问码
      const code = generateInviteCode() // 可以复用同样的生成逻辑
      
      const accessCode = await prisma.accessCode.create({
        data: {
          code,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: adminUserId,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      })

      return NextResponse.json(accessCode)
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error creating code:', error)
    return NextResponse.json(
      { error: 'Failed to create code' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, codeId, type } = data

    if (!adminUserId || !codeId || !type) {
      return NextResponse.json(
        { error: 'adminUserId, codeId, and type are required' },
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

    if (type === 'invite') {
      // 删除邀请码
      await prisma.inviteCode.delete({
        where: { id: codeId },
      })
    } else if (type === 'access') {
      // 删除访问码
      await prisma.accessCode.delete({
        where: { id: codeId },
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Code deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting code:', error)
    return NextResponse.json(
      { error: 'Failed to delete code' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, codeId, type, action, ...updateData } = data

    if (!adminUserId || !codeId || !type || !action) {
      return NextResponse.json(
        { error: 'adminUserId, codeId, type, and action are required' },
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
    if (type === 'invite') {
      if (action === 'toggle') {
        // 切换邀请码状态
        const inviteCode = await prisma.inviteCode.findUnique({
          where: { id: codeId }
        })
        
        if (!inviteCode) {
          return NextResponse.json(
            { error: 'Invite code not found' },
            { status: 404 }
          )
        }

        result = await prisma.inviteCode.update({
          where: { id: codeId },
          data: { isUsed: !inviteCode.isUsed },
        })
      } else {
        return NextResponse.json(
          { error: 'Invalid action for invite code' },
          { status: 400 }
        )
      }
    } else if (type === 'access') {
      if (action === 'toggle') {
        // 切换访问码状态
        const accessCode = await prisma.accessCode.findUnique({
          where: { id: codeId }
        })
        
        if (!accessCode) {
          return NextResponse.json(
            { error: 'Access code not found' },
            { status: 404 }
          )
        }

        result = await prisma.accessCode.update({
          where: { id: codeId },
          data: { isActive: !accessCode.isActive },
        })
      } else {
        return NextResponse.json(
          { error: 'Invalid action for access code' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error updating code:', error)
    return NextResponse.json(
      { error: 'Failed to update code' },
      { status: 500 }
    )
  }
}
