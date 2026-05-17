; Envoy NSIS Installer Theme Hooks
; MUI2 style customization

; Show warning when user tries to abort
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要退出 Envoy 安装程序吗？"

; Install progress page colors (dark text on light background)
!define MUI_INSTFILESPAGE_COLORS "454545 F5F5F5"

; Welcome page title and text
!define MUI_WELCOMEPAGE_TITLE "欢迎使用 Envoy 安装向导"
!define MUI_WELCOMEPAGE_TEXT "即将在您的计算机上安装 Envoy $_CLICK\r\n\r\nEnvoy 是一个团队 AI Agent 协作桌面客户端。\r\n\r\n建议在安装前关闭其他应用程序。"

; Finish page text
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "Envoy 已成功安装到您的计算机上。"
