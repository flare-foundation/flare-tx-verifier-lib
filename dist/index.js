"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify = void 0;
const evm_1 = require("./evm");
const avax_1 = require("./avax");
__exportStar(require("./interface"), exports);
function verify(txHex) {
    return __awaiter(this, void 0, void 0, function* () {
        let verification;
        verification = yield (0, evm_1.verify)(txHex);
        if (verification != null) {
            return verification;
        }
        verification = yield (0, avax_1.verify)(txHex);
        if (verification != null) {
            return verification;
        }
        return null;
    });
}
exports.verify = verify;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSwrQkFBMkM7QUFDM0MsaUNBQTZDO0FBRTdDLDhDQUEyQjtBQUUzQixTQUFzQixNQUFNLENBQUMsS0FBYTs7UUFDdEMsSUFBSSxZQUFtQyxDQUFBO1FBRXZDLFlBQVksR0FBRSxNQUFNLElBQUEsWUFBUyxFQUFDLEtBQUssQ0FBQyxDQUFBO1FBQ3BDLElBQUksWUFBWSxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sWUFBWSxDQUFBO1FBQ3ZCLENBQUM7UUFFRCxZQUFZLEdBQUcsTUFBTSxJQUFBLGFBQVUsRUFBQyxLQUFLLENBQUMsQ0FBQTtRQUN0QyxJQUFJLFlBQVksSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN2QixPQUFPLFlBQVksQ0FBQTtRQUN2QixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUE7SUFDZixDQUFDO0NBQUE7QUFkRCx3QkFjQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFR4VmVyaWZpY2F0aW9uIH0gZnJvbSBcIi4vaW50ZXJmYWNlXCJcbmltcG9ydCB7IHZlcmlmeSBhcyB2ZXJpZnlFdm0gfSBmcm9tIFwiLi9ldm1cIlxuaW1wb3J0IHsgdmVyaWZ5IGFzIHZlcmlmeUF2YXggfSBmcm9tIFwiLi9hdmF4XCJcblxuZXhwb3J0ICogZnJvbSBcIi4vaW50ZXJmYWNlXCJcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeSh0eEhleDogc3RyaW5nKTogUHJvbWlzZTxUeFZlcmlmaWNhdGlvbiB8IG51bGw+IHtcbiAgICBsZXQgdmVyaWZpY2F0aW9uOiBUeFZlcmlmaWNhdGlvbiB8IG51bGxcbiAgICBcbiAgICB2ZXJpZmljYXRpb249IGF3YWl0IHZlcmlmeUV2bSh0eEhleClcbiAgICBpZiAodmVyaWZpY2F0aW9uICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHZlcmlmaWNhdGlvblxuICAgIH1cblxuICAgIHZlcmlmaWNhdGlvbiA9IGF3YWl0IHZlcmlmeUF2YXgodHhIZXgpXG4gICAgaWYgKHZlcmlmaWNhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB2ZXJpZmljYXRpb25cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbFxufSJdfQ==