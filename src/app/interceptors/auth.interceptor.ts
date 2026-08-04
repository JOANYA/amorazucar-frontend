import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Ignorar el interceptor si la petición es para el login o registro
  if (req.url.includes('/login') || req.url.includes('/registro')) {
    return next(req);
  }

  const token = 
    localStorage.getItem('azucaryamor_token') || 
    localStorage.getItem('token') || 
    localStorage.getItem('jwt');

  if (!token) {
    return next(req);
  }

  const reqConToken = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(reqConToken);
};