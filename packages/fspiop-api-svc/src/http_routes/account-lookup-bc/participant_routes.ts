/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

"use strict";
import express from "express";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { Constants, Validate } from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import { MLKafkaJsonProducerOptions } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { ParticipantQueryReceivedEvtPayload, ParticipantQueryReceivedEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { BaseRoutes } from "../_base_router";

export class ParticipantRoutes extends BaseRoutes {

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        super(producerOptions, kafkaTopic, logger);

        // bind routes

        // GET Participant by Type & ID
        this.router.get("/:type/:id/", this.getParticipantsByTypeAndID.bind(this));
        // GET Participants by Type, ID & SubId
        this.router.get("/:type/:id/:subid", this.getParticipantsByTypeAndIDAndSubId.bind(this));
    }

    get Router(): express.Router {
        return this.router;
    }

    private async getParticipantsByTypeAndID(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this.logger.debug("Got getParticipantsByTypeAndID request");

        const clonedHeaders = { ...req.headers };
        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        const isValidHeaders = Validate.validateHeaders(Constants.RequiredHeaders.participants, clonedHeaders);

        if(!isValidHeaders || !type || !id || !requesterFspId){
            res.status(400).json({
                status: "not ok"
            });
            return next();
        }

        const msgPayload: ParticipantQueryReceivedEvtPayload = {
            requesterFspId: requesterFspId,
            partyType: type,
            partyId: id,
            partySubType: null,
            currency: currency
        };

        const msg =  new ParticipantQueryReceivedEvt(msgPayload);

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: null,
            headers: clonedHeaders
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("getParticipantsByTypeAndID sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("getParticipantsByTypeAndID responded");
    }

    private async getParticipantsByTypeAndIDAndSubId(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
        this.logger.debug("Got getParticipantsByTypeAndIDAndSubId request");

        const clonedHeaders = { ...req.headers };
        const type = req.params["type"] as string || null;
        const id = req.params["id"] as string || null;
        const partySubIdOrType = req.params["subid"] as string || null;
        const requesterFspId = req.headers[Constants.FSPIOP_HEADERS_SOURCE] as string || null;

        const currency = req.query["currency"] as string || null;

        const isValidHeaders = Validate.validateHeaders(Constants.RequiredHeaders.participants, clonedHeaders);

        if(!isValidHeaders || !type || !id || !requesterFspId || !partySubIdOrType){
            res.status(400).json({
                status: "not ok"
            });
            return next();
        }

        const msgPayload: ParticipantQueryReceivedEvtPayload = {
            requesterFspId: requesterFspId,
            partyType: type,
            partyId: id,
            partySubType: partySubIdOrType,
            currency: currency
        };

        const msg =  new ParticipantQueryReceivedEvt(msgPayload);

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState for the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: null,
            headers: clonedHeaders
        };

        await this.kafkaProducer.send(msg);

        this.logger.debug("getParticipantsByTypeAndIDAndSubId sent message");

        res.status(202).json({
            status: "ok"
        });

        this.logger.debug("getParticipantsByTypeAndIDAndSubId responded");
    }

    async init(): Promise<void>{
        await this.kafkaProducer.connect();
    }

    async destroy(): Promise<void>{
        await this.kafkaProducer.destroy();
    }
}
