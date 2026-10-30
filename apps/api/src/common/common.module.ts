import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Membership } from "../entities";

/** Makes the membership repository available everywhere, because every business route checks the caller's role. */
@Global()
@Module({ imports: [TypeOrmModule.forFeature([Membership])], exports: [TypeOrmModule] })
export class CommonModule {}
