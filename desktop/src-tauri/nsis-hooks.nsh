!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'taskkill /F /IM mmt-sync.exe /T'
  Sleep 500
!macroend
