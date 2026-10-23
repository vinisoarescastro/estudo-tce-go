// Batida de um segundo fora da thread da página. Abas em segundo plano têm os timers da página
// atrasados (até uma vez por minuto), mas os de um worker seguem em dia.
setInterval(() => self.postMessage(0), 1000);
