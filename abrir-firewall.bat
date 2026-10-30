@echo off
echo A abrir porta 8081 no Windows Firewall...
netsh advfirewall firewall add rule name="SMSGateway Docker 8081" dir=in action=allow protocol=TCP localport=8081
if %errorlevel%==0 (
    echo OK - porta 8081 aberta para ligacoes da rede local.
) else (
    echo ERRO - execute este ficheiro como Administrador ^(clique direito^).
)
pause