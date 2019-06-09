cd %~dp0..\..
echo Testing DBAssistant add manual mode

node bin\cli.js add -m -d test\add_integration\db.ReaperFileList -u "Super Custom Tag" "..\Mock\Source\0026_bell riser.wav" ..\Mock\Source\Metadata\Basehead_Metadata.wav

pause