const { plainToInstance } = require('class-transformer');

class GetAllAdminDto {
    name;
    mobile;
    type;
}

const reqQuery = { type: 'admin' };
const transformed = plainToInstance(GetAllAdminDto, reqQuery);
console.log('transformed keys:', Object.keys(transformed));
console.log('transformed values:', transformed);
console.log('spread:', { ...transformed });
