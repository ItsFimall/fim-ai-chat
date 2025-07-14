'use client';

import React, { ReactNode } from 'react';
import { 
  Box, 
  Paper, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemButton,
  ListItemIcon,
  Divider,
  TextField,
  InputAdornment,
  Tooltip,
  Menu,
  MenuItem,
  Avatar,
  Stack
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Send as SendIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  History as HistoryIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  SmartToy as SmartToyIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ThemeToggle } from './MaterialUI';
import { useTheme } from '@/contexts/ThemeContext';
import { sortGroupsByUserOrder, getModelGroups } from '@/utils/aiModelUtils';
import { AIIcon } from './AIIcon';
import { MessageActions } from './MessageActions';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  modelInfo?: {
    modelId: string;
    modelName: string;
    providerId: string;
    providerName: string;
  };
  tokenUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    is_estimated?: boolean;
  };
}

interface ChatHistory {
  id: string;
  title: string;
}

interface MaterialChatLayoutProps {
  title?: string;
  chatHistories: ChatHistory[];
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  onLogout?: () => void;
  onSettings?: () => void;
  renderMessageContent: (message: ChatMessage) => ReactNode;
  modelName?: string;
  providerName?: string;
  userName?: string;
  models?: Array<{
    id: string, 
    name: string,
    group?: string,
    provider?: string
  }>;
  modelGroups?: Array<{ groupName: string; order: number }>;
  onModelSelect?: (modelId: string) => void;
  currentModelId?: string;
  chatTitle?: string;
  onChatTitleChange?: (newTitle: string) => void;
  onCopyMessage?: (messageId: string, content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onRetryMessage?: (messageId: string) => void;
  drawerOpen?: boolean;
  onDrawerToggle?: () => void;
}

const DRAWER_WIDTH = 280;

export const MaterialChatLayout: React.FC<MaterialChatLayoutProps> = ({
  title = 'FimAI Chat',
  chatHistories,
  messages,
  input,
  isLoading,
  onInputChange,
  onSend,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onKeyPress,
  onLogout,
  onSettings,
  renderMessageContent,
  modelName,
  providerName,
  userName = '用户',
  models = [],
  modelGroups = [],
  onModelSelect,
  currentModelId,
  chatTitle = '',
  onChatTitleChange,
  onCopyMessage,
  onDeleteMessage,
  onEditMessage,
  onRetryMessage,
  drawerOpen = false,
  onDrawerToggle
}) => {
  // Remove the internal drawer state and use props instead
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [modelMenuAnchorEl, setModelMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editableTitle, setEditableTitle] = React.useState(chatTitle);
  const { mode } = useTheme();
  
  // 创建消息气泡的引用数组 - 移到组件顶层，避免hooks顺序问题
  const messageBubbleRefs = React.useRef<{ [key: string]: React.RefObject<HTMLDivElement> }>({});
  
  // 确保每个消息都有一个引用
  React.useEffect(() => {
    // 为每个消息创建或获取引用
    messages.forEach(message => {
      if (!messageBubbleRefs.current[message.id]) {
        messageBubbleRefs.current[message.id] = React.createRef<HTMLDivElement>();
      }
    });
  }, [messages]);
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleModelMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setModelMenuAnchorEl(event.currentTarget);
  };

  const handleModelMenuClose = () => {
    setModelMenuAnchorEl(null);
  };

  // 使用从外部传入的状态和处理器
  const handleDrawerToggle = () => {
    if (onDrawerToggle) {
      onDrawerToggle();
    }
  };

  const handleSettings = () => {
    handleMenuClose();
    if (onSettings) onSettings();
  };

  const handleLogout = () => {
    handleMenuClose();
    if (onLogout) onLogout();
  };

  const handleModelSelect = (modelId: string) => {
    if (onModelSelect) {
      onModelSelect(modelId);
      handleModelMenuClose();
    }
  };

  // 处理标题编辑
  const handleTitleEdit = () => {
    setEditableTitle(chatTitle);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    // 限制标题长度为8字
    const trimmedTitle = editableTitle.trim().slice(0, 8);
    if (onChatTitleChange && trimmedTitle) {
      onChatTitleChange(trimmedTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
  };

  // 抽屉内容
  const drawer = (
    <>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="div">
          会话列表
        </Typography>
        <IconButton edge="end" color="inherit" onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box 
          onClick={onNewChat}
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1.5,
            border: '1px dashed',
            borderColor: 'text.secondary',
            borderRadius: 1,
            cursor: 'pointer',
            mb: 2,
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          <Typography>新建会话</Typography>
        </Box>
      </Box>
      <List sx={{ overflow: 'auto', flexGrow: 1 }}>
        {chatHistories.map((chat) => (
          <ListItem 
            key={chat.id}
            disablePadding
            secondaryAction={
              <IconButton 
                edge="end" 
                onClick={(e) => { 
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemButton onClick={() => onSelectChat(chat.id)}>
              <ListItemIcon>
                <HistoryIcon />
              </ListItemIcon>
              <ListItemText 
                primary={chat.title || '新会话'} 
                primaryTypographyProps={{ 
                  noWrap: true,
                  sx: { maxWidth: '160px' }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        <ThemeToggle />
      </Box>
    </>
  );

  // 获取带有自定义分组的模型数据
  const getGroupedModels = () => {
    // 首先按分组归类模型
    const modelsByGroup: Record<string, Array<{id: string, name: string, provider?: string}>> = {};
    
    models.forEach(model => {
      const groupName = model.group || '其他';
      if (!modelsByGroup[groupName]) {
        modelsByGroup[groupName] = [];
      }
      modelsByGroup[groupName].push({
        id: model.id,
        name: model.name,
        provider: model.provider
      });
    });
    
    // 使用用户自定义排序对分组进行排序
    const sortedGroups = sortGroupsByUserOrder(modelsByGroup, modelGroups);
    
    return sortedGroups.map(groupName => ({
      groupName,
      models: modelsByGroup[groupName]
    }));
  };

  const groupedModels = getGroupedModels();

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 侧边栏抽屉 */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'block' },
          '& .MuiDrawer-paper': { 
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* 主内容区 */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flexGrow: 1, 
        overflow: 'hidden',
        height: '100%'
      }}>
        {/* 顶部应用栏 */}
        <AppBar 
          position="static" 
          color="default" 
          sx={{ 
            bgcolor: mode === 'light' ? 'background.paper' : 'background.default',
            boxShadow: 1
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            
            <Typography variant="h6" component="div" sx={{ mr: 2 }}>
              {title}
            </Typography>
            
            {/* 中间空间用于居中显示聊天标题 */}
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              {messages.length > 0 && (
                <Box 
                  sx={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={!isEditingTitle ? handleTitleEdit : undefined}
                >
                  {isEditingTitle ? (
                    <TextField
                      value={editableTitle}
                      onChange={(e) => setEditableTitle(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyPress={handleTitleKeyPress}
                      size="small"
                      autoFocus
                      inputProps={{ maxLength: 8 }}
                      sx={{ width: '200px' }}
                      placeholder="输入标题（最多8字）"
                    />
                  ) : (
                    <Typography variant="subtitle1" fontWeight="medium">
                      {chatTitle || '新对话'}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            
            {/* 模型选择器 */}
            {models.length > 0 && (
              <>
                <Box 
                  onClick={handleModelMenuOpen}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    py: 0.5,
                    px: 1.5,
                    mr: 2
                  }}
                >
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    {modelName || '选择模型'}
                  </Typography>
                  {currentModelId && <AIIcon modelId={currentModelId} size={16} />}
                </Box>
                <Menu
                  id="model-menu"
                  anchorEl={modelMenuAnchorEl}
                  keepMounted
                  open={Boolean(modelMenuAnchorEl)}
                  onClose={handleModelMenuClose}
                  PaperProps={{
                    style: {
                      maxHeight: 400,
                      width: 250,
                    },
                  }}
                >
                  {groupedModels.map(({groupName, models: groupModels}) => {
                    return (
                      <div key={groupName}>
                        <ListItem sx={{ py: 0, px: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ 
                              mr: 1, 
                              display: 'flex', 
                              alignItems: 'center',
                              backgroundColor: 'background.paper',
                              borderRadius: '50%',
                              p: 0.5
                            }}>
                              <AIIcon modelId={groupName} size={16} />
                            </Box>
                            <ListItemText 
                              primary={groupName} 
                              primaryTypographyProps={{ 
                                variant: 'caption',
                                color: 'text.secondary',
                                fontWeight: 'bold'
                              }} 
                            />
                          </Box>
                        </ListItem>
                        <Divider />
                        {groupModels.map(model => (
                          <MenuItem 
                            key={model.id} 
                            onClick={() => handleModelSelect(model.id)}
                            selected={currentModelId === model.id}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              backgroundColor: mode === 'light' ? 'grey.100' : 'grey.800',
                              width: 24,
                              height: 24
                            }}>
                              <AIIcon modelId={groupName} size={16} />
                            </Box>
                            <Typography variant="body2" noWrap>
                              {model.name}
                            </Typography>
                          </MenuItem>
                        ))}
                      </div>
                    );
                  })}
                </Menu>
              </>
            )}
            
            <IconButton
              aria-label="more"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              color="inherit"
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              keepMounted
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              {onSettings && (
                <MenuItem onClick={handleSettings}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>设置</ListItemText>
                </MenuItem>
              )}
              {onLogout && (
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>退出登录</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </Toolbar>
        </AppBar>

        {/* 消息区域 */}
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          p: 2,
          bgcolor: mode === 'light' ? '#f5f5f5' : '#121212',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{ 
            maxWidth: { xs: '100%', sm: '80%', md: '800px' }, 
            width: '100%', 
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {messages.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                opacity: 0.7
              }}>
                <Typography variant="h4" gutterBottom>
                  👋 欢迎使用 FimAI Chat
                </Typography>
                <Typography variant="body1" textAlign="center">
                  开始一个新的对话，输入您的问题或指令。
                </Typography>
              </Box>
            ) : (
              messages.map((message) => {
                return (
                  <Box 
                    key={message.id} 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                      mb: 2,
                      gap: 1
                    }}
                  >
                    {/* 头像区域 */}
                    <Avatar 
                      sx={{ 
                        bgcolor: message.role === 'user' 
                          ? (mode === 'light' ? '#212121' : '#e0e0e0') 
                          : (mode === 'light' ? '#9e9e9e' : '#424242'),
                        color: message.role === 'user'
                          ? (mode === 'light' ? '#fff' : '#000')
                          : (mode === 'light' ? '#fff' : '#000'),
                        width: 36,
                        height: 36,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                    >
                      {message.role === 'user' ? 
                        <PersonIcon /> : 
                        (message.modelInfo?.modelId ? 
                          <AIIcon modelId={message.modelInfo.providerId || message.modelInfo.modelId} size={24} /> : 
                          <SmartToyIcon />)
                      }
                    </Avatar>
                    
                    <Box sx={{ maxWidth: '85%', width: '100%' }}>
                      {/* 发送者名称 */}
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 0.5, 
                          textAlign: message.role === 'user' ? 'right' : 'left' 
                        }}
                      >
                        {message.role === 'user' ? userName : (message.modelInfo?.modelName || modelName || 'AI助手')}
                      </Typography>
                      
                      {/* 消息气泡 */}
                      <Paper 
                        ref={messageBubbleRefs.current[message.id]}
                        elevation={0}
                        sx={{ 
                          py: 1.5,  // 统一上下内边距
                          px: 2,    // 保持左右内边距
                          bgcolor: message.role === 'user' 
                            ? (mode === 'light' ? '#e0e0e0' : '#333333') 
                            : (mode === 'light' ? '#ffffff' : '#1e1e1e'),
                          borderRadius: 2,
                          position: 'relative',
                          cursor: 'default' // 确保鼠标样式正常
                        }}
                      >
                        {/* 消息内容或编辑框 */}
                        {renderMessageContent(message)}
                      </Paper>

                      {/* 消息操作按钮 - 移至气泡外部 */}
                      <Box 
                        sx={{ 
                          mt: 0.5,  // 减小上边距，使按钮更靠近气泡
                          display: 'flex',
                          justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                          padding: '5px 0', // 添加上下内边距，扩大可点击区域
                        }}
                      >
                        <MessageActions
                          content={message.content}
                          messageRole={message.role}
                          onCopy={() => onCopyMessage?.(message.id, message.content)}
                          onDelete={() => onDeleteMessage?.(message.id)}
                          onEdit={(newContent) => onEditMessage?.(message.id, newContent)}
                          onResend={() => onRetryMessage?.(message.id)}
                          tokenUsage={message.tokenUsage}
                          isInMessageBubble={false}
                          parentRef={messageBubbleRefs.current[message.id]}
                        />
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* 输入区域 */}
        <Paper 
          elevation={3} 
          sx={{ 
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ 
            maxWidth: { xs: '100%', sm: '80%', md: '800px' }, 
            width: '100%', 
            mx: 'auto' 
          }}>
            <TextField
              fullWidth
              placeholder="输入消息..."
              value={input}
              onChange={onInputChange}
              onKeyPress={onKeyPress}
              disabled={isLoading}
              multiline
              maxRows={4}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton 
                      onClick={onSend} 
                      disabled={isLoading || !input.trim()}
                      color="primary"
                    >
                      <SendIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }}
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}; 