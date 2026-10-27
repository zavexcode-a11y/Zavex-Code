/* Site settings. Edit this file only.
   apiUrl: address of your ZavexCode backend (the /backend folder).
     ""                          -> backend off: forms are sent through FormSubmit (current behaviour)
     "/"                         -> backend on the same domain as the website
     "https://api.example.com"   -> backend on another domain (add the site to ALLOWED_ORIGINS there)
   If the backend is unreachable the forms fall back to FormSubmit automatically. */
window.ZX_CONFIG = { apiUrl: "" };
