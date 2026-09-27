# Comentario analítico — Actividad 4

El dashboard consolida los resultados de la Actividad 3 para los perfiles load, stress, spike, soak y breakpoint, con las métricas del contenedor registradas con `docker stats`. Mientras la A3 se enfocó en ejecutar y fortalecer la prueba, esta actividad analiza el sistema a partir de esa evidencia. Se seleccionaron dos KPI (indicadores clave de desempeño) críticos: la latencia P95 y el throughput, porque juntos describen la experiencia del usuario y la capacidad del servicio frente a los SLO (objetivos de nivel de servicio) definidos por el equipo.

**KPI 1 — Latencia P95 (SLO < 800 ms).** Es el indicador principal: refleja el tiempo del 95 % de las solicitudes sin distorsión por valores aislados. Resultados: load 7,45 ms; stress 7,69 ms; spike 5,98 ms; soak 10,11 ms y breakpoint 8,09 ms. El peor caso (soak) consume apenas el 1,26 % del SLO. El P99 también cumple (máximo 13,98 ms frente a 1500 ms). La latencia no creció con la concurrencia: entre 15 y 1000 usuarios virtuales (VU) no se observaron señales de formación de colas en la latencia medida.

**KPI 2 — Throughput (solicitudes por segundo, `http_reqs rate`).** Valores: load 9,30; stress 32,79; spike 51,89; soak 8,69 y breakpoint 356,58 req/s. Solo breakpoint supera la referencia de 150 req/s. La brecha en los demás perfiles se explica principalmente por el modelo de carga: el think time de 1 a 3 segundos limita la tasa de cada VU. El throughput se multiplicó casi por siete entre spike y breakpoint sin errores (0 %) ni degradación de la latencia.

**Métricas de sistema.** Durante breakpoint, el uso de CPU aumentó conforme avanzó la carga y alcanzó un máximo de 27,46 %, mientras que la RAM llegó a 205,7 MiB. Al finalizar la carga, ambas métricas descendieron hacia sus niveles base, sin observarse señales de saturación sostenida durante la ventana analizada; este retorno tampoco muestra evidencia de fuga de memoria. En soak la CPU osciló entre 0,4 % y 2,9 %, la RAM entre 116,4 y 120,5 MiB, y el Block I/O no varió.

**Vínculo con la arquitectura.** Restful-Booker es una aplicación Node.js/Express que corre en un solo proceso, sin módulo `cluster`, por lo que aprovecha un único núcleo; el 27 % de CPU sugiere margen, aunque el techo práctico lo determinaría ese proceso. La base de datos es LokiJS en memoria y la colección se crea sin índices explícitos: `GET /booking` usa `booking.find(query)` y las operaciones por identificador usan `findOne({ bookingid })`, que sin índices recorren la colección. Hoy son rápidas porque la colección está casi vacía, pero su costo tiende a crecer con el volumen. Además, `GET /booking` no implementa paginación ni límite, y el entorno probado usa un único contenedor sin réplicas ni balanceador.

**Recomendaciones priorizadas** (alto impacto y baja complejidad), orientadas al sistema y no a la metodología de prueba:

| Prioridad | Acción | Impacto | Esfuerzo | SLO que protege |
|---|---|---|---|---|
| 1 | Declarar índices en LokiJS: único en `bookingid` e índices en `firstname` y `lastname` | Alto | Bajo | P95 y P99 |
| 2 | Paginar y limitar `GET /booking` con parámetros `page` y `limit` | Alto | Bajo | P95 y throughput |
| 3 | Escalar horizontalmente con réplicas balanceadas o módulo `cluster` | Alto | Alto | Throughput |

La primera requiere una línea en `addCollection` y reduce el riesgo de que la latencia crezca con el volumen de datos. La segunda acota el tamaño de cada respuesta. La tercera queda de última porque exige antes trasladar los datos a una base compartida: con LokiJS en memoria, cada proceso tendría su propia copia de las reservas.

En conclusión, el sistema cumplió los SLO de latencia y error en el rango probado; las acciones buscan conservar ese margen cuando crezcan los datos y el tráfico.
