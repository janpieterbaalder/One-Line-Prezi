process.chdir('C:\\Users\\rogst\\Desktop\\Baalderborg Groep\\rittenregistratie')
require('child_process').execSync('npx vite --port 5174', { stdio: 'inherit' })
