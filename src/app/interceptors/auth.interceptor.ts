import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // No enviar token en login/registro (match exacto al final de la URL,
  // antes se usaba includes() y cualquier URL con ese texto quedaba sin token).
  if (/\/usuarios\/(login|registro)(\?|$)/.test(req.url)) {
    return next(req);
  }

  // Una sola clave de token (antes se buscaban 3 distintas y era frágil).
  const token = localStorage.getItem('azucaryamor_token');

  if (!token) {
    return next(req);
  }

  const reqConToken = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(reqConToken);
};