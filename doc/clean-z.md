# clean-z

`clean-z` script cleans the output by deleting output directories (`dist/`, `target/`, and cache one).

1. Adjust `package.json` scripts:
   ```json
   {
     "scripts": {
       "clean": "clean-z"
     }
   }
   ```
2. Invoke cleanup:
   ```shell
   npm run clean
   ```
