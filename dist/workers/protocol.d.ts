import { SerializedError, TransferableDecodedImage, WorkerRequest } from '../types/worker';
import { DecodedImage } from '../types/image';

/**
 * Serialize an Error into a transferable format for postMessage.
 */
export declare function serializeError(error: unknown): SerializedError;
/**
 * Deserialize a SerializedError back into an Error object.
 */
export declare function deserializeError(serialized: SerializedError): Error;
/**
 * Convert a DecodedImage to a TransferableDecodedImage for postMessage.
 * The pixel data ArrayBuffer is extracted so it can be listed in the transfer list.
 */
export declare function toTransferable(image: DecodedImage): {
    data: TransferableDecodedImage;
    transfer: Transferable[];
};
/**
 * Convert a TransferableDecodedImage back into a DecodedImage.
 */
export declare function fromTransferable(transferred: TransferableDecodedImage): DecodedImage;
/**
 * Extract transferable objects from a WorkerRequest for zero-copy posting.
 */
export declare function getRequestTransferables(request: WorkerRequest): Transferable[];
/**
 * Generate a unique request ID.
 */
export declare function generateRequestId(): string;
//# sourceMappingURL=protocol.d.ts.map