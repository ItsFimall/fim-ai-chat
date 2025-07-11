import { NextRequest, NextResponse } from 'next/server'
import { checkUserPermission } from '@/lib/auth'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { adminUserId, confirmText } = data

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

    // 验证确认文本
    if (confirmText !== 'RESET DATABASE') {
      return NextResponse.json(
        { error: 'Invalid confirmation text. Please type "RESET DATABASE" exactly.' },
        { status: 400 }
      )
    }

    // 获取项目根目录
    const projectRoot = process.cwd()
    
    try {
      console.log('Starting database reset...')
      
      // 执行数据库重置命令
      const { stdout: resetOutput, stderr: resetError } = await execAsync('npm run db:reset', {
        cwd: projectRoot,
        timeout: 30000, // 30秒超时
      })
      
      if (resetError) {
        console.error('Database reset stderr:', resetError)
      }
      
      console.log('Database reset output:', resetOutput)
      
      // 执行数据库种子
      const { stdout: seedOutput, stderr: seedError } = await execAsync('npm run db:seed', {
        cwd: projectRoot,
        timeout: 30000, // 30秒超时
      })
      
      if (seedError) {
        console.error('Database seed stderr:', seedError)
      }
      
      console.log('Database seed output:', seedOutput)

      return NextResponse.json({
        success: true,
        message: 'Database has been successfully reset and reseeded',
        details: {
          resetOutput: resetOutput.trim(),
          seedOutput: seedOutput.trim(),
        }
      })

    } catch (execError: any) {
      console.error('Database reset execution error:', execError)
      
      return NextResponse.json(
        { 
          error: 'Failed to reset database',
          details: execError.message,
          stdout: execError.stdout,
          stderr: execError.stderr,
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Database reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const adminUserId = searchParams.get('adminUserId')

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

    // 返回数据库重置信息
    return NextResponse.json({
      available: true,
      warning: 'This action will permanently delete all data and cannot be undone.',
      confirmationRequired: 'RESET DATABASE',
      steps: [
        'All user accounts will be deleted',
        'All chat conversations will be deleted', 
        'All invite codes and access codes will be deleted',
        'All token usage statistics will be deleted',
        'Database will be recreated with default schema',
        'Default providers and models will be reseeded',
        'You will need to register a new admin account'
      ]
    })

  } catch (error) {
    console.error('Error getting database reset info:', error)
    return NextResponse.json(
      { error: 'Failed to get database reset information' },
      { status: 500 }
    )
  }
}
