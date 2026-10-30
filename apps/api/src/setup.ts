import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/** Settings shared by the real server and the tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

export function addDocs(app: INestApplication) {
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("Orderia API").setDescription("Appointments, QR table ordering and payments for hotels, salons, parlours, clinics and restaurants.").setVersion("0.1").addBearerAuth().build());
  SwaggerModule.setup("api/docs", app, doc);
}
