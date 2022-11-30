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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

"use strict";

import express from "express";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Constants} from "@mojaloop/interop-apis-bc-fspiop-utils-lib";
import {MLKafkaJsonProducer, MLKafkaJsonProducerOptions} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import { IncomingHttpHeaders } from "http";
import ajv from "ajv";
import { schemaValidator } from "../ajv";
import { QuoteQueryReceivedEvt, QuoteQueryReceivedEvtPayload, QuoteRequestReceivedEvt, QuoteRequestReceivedEvtPayload, QuoteResponseReceivedEvt, QuoteResponseReceivedEvtPayload } from "@mojaloop/platform-shared-lib-public-messages-lib";

const getEnabledHeaders = (headers: IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([headerKey]) => Constants.FSPIOP_REQUIRED_HEADERS_LIST.includes(headerKey)));
 
export class BulkQuotesRoutes {
    private _logger: ILogger;
    private _producerOptions: MLKafkaJsonProducerOptions;
    private _kafkaProducer: MLKafkaJsonProducer;
    private _kafkaTopic: string;

    private _router = express.Router();

    constructor(producerOptions: MLKafkaJsonProducerOptions, kafkaTopic: string, logger: ILogger) {
        this._logger = logger.createChild("ParticipantBulkRoutes");
        this._producerOptions = producerOptions;
        this._kafkaTopic = kafkaTopic;
        this._kafkaProducer = new MLKafkaJsonProducer(this._producerOptions);

        // bind routes
 
        // // GET Quote by ID
        // this._router.get("/:id/", this.quoteQueryReceived.bind(this));
        
        // POST Quote Calculation
        this._router.post("/", this.quoteRequestReceived.bind(this));

        // // PUT Quote Created
        // this._router.put("/:id", this.quoteResponseReceived.bind(this));
    }

    get Router(): express.Router {
        return this._router;
    }

    
    private async quoteRequestReceived(req: express.Request, res: express.Response): Promise<void> {
        this._logger.debug("Got quoteRequestReceived request");
        
        const validate = schemaValidator.getSchema("QuotesPostRequest") as ajv.ValidateFunction;
        const valid = validate(req.body);
        
        if (!valid) {
            this._logger.error(validate.errors)

            this._logger.debug(`quoteRequestReceived body errors: ${JSON.stringify(validate.errors)}`);

            res.status(422).json({
                status: "invalid request body",
                errors: validate.errors
            });
            return;
        }
          
        // Headers
        const clonedHeaders = { ...req.headers };
        const requesterFspId = clonedHeaders[Constants.FSPIOP_HEADERS_SOURCE] as string || null;
        const destinationFspId = clonedHeaders[Constants.FSPIOP_HEADERS_DESTINATION] as string || null;
        
        // Date Model
        const quoteId = req.body["quoteId"] || null;
        const transactionId = req.body["transactionId"] || null;
        const transactionRequestId = req.body["transactionRequestId"] || null;
        const payee = req.body["payee"] || null;
        const payer = req.body["payer"] || null;
        const amountType = req.body["amountType"] || null;
        const amount = req.body["amount"] || null;
        const fees = req.body["fees"] || null;
        const transactionType = req.body["transactionType"] || null;
        const geoCode = req.body["geoCode"] || null;
        const note = req.body["note"] || null;
        const expiration = req.body["expiration"] || null;
        const extensionList = req.body["extensionList"] || null;

        if(!requesterFspId || !quoteId || !transactionId || !payee || !payer || !amountType || !amount || !transactionType) {
            res.status(400).json({
                status: "not ok"
            });
            return;
        }

        // {
        //     "bulkQuoteId": "8843fdbe-5dea-3abd-a210-3780e7f2f17a",
        //     "payer": {
        //         "partyIdInfo": {
        //         "partyIdType": "MSISDN",
        //         "partyIdentifier": "1"
        //         }
        //     },
        //     "individualQuotes": [
        //         {
        //             "quoteId": "2243fdbe-5dea-3abd-a210-3780e7f2f1f4",
        //             "transactionId": "7f5d9784-3a57-5865-9aa0-7dde7791548a",
        //             "payee": {
        //                 "partyIdInfo": {
        //                 "partyIdType": "MSISDN",
        //                 "partyIdentifier": "1"
        //                 }
        //             },
        //             "amountType": "SEND",
        //             "amount": {
        //                 "currency": "EUR",
        //                 "amount": "1"
        //             },
        //             "transactionType": {
        //                 "scenario": "DEPOSIT",
        //                 "initiator": "PAYER",
        //                 "initiatorType": "BUSINESS"
        //             }
        //         }
        //     ]
        // }

        
        const msgPayload: QuoteRequestReceivedEvtPayload = {
            quoteId: quoteId,
            transactionId: transactionId,
            transactionRequestId: transactionRequestId,
            payee: payee,
            payer: payer,
            amountType: amountType,
            amount: amount,
            fees: fees,
            transactionType: transactionType,
            geoCode: geoCode,
            note: note,
            expiration: expiration,
            extensionList: extensionList,
        } as unknown as QuoteRequestReceivedEvtPayload;

        const msg =  new QuoteRequestReceivedEvt(msgPayload);

        // Since we don't export the types of the body (but we validate them in the entrypoint of the route),
        // we can use the builtin method of validatePayload of the evt messages to make sure consistency 
        // is shared between both
        msg.validatePayload();

        // this is an entry request (1st in the sequence), so we create the fspiopOpaqueState to the next event from the request
        msg.fspiopOpaqueState = {
            requesterFspId: requesterFspId,
            destinationFspId: destinationFspId,
            headers: getEnabledHeaders(clonedHeaders)
        };

        await this._kafkaProducer.send(msg);

        this._logger.debug("quoteRequestReceived sent message");

        res.status(202).json({
            status: "ok"
        });

        this._logger.debug("quoteRequestReceived responded");
    }

    async init(): Promise<void>{
        await this._kafkaProducer.connect();
    }

    async destroy(): Promise<void>{
        await this._kafkaProducer.destroy();
    }
}
 