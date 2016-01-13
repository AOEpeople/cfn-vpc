/**
 * "Inspired" by:
 *
 * @see http://www.spacevatican.org/2015/12/20/cloudformation-nat-gateway/
 * @see https://gist.github.com/fcheung/baec53381350a4b11037
 */
var aws = require('aws-sdk');
var ec2 = new aws.EC2();
var response = require('cfn-response');

exports.handler = function (event, context) {
    if (event.ResourceType === 'Custom::NatGateway') {
        handleGateway(event, context);
    } else if (event.ResourceType === 'Custom::NatGatewayRoute') {
        handleRoute(event, context);
    } else {
        errorExit("Unknown resource type: " + event.ResourceType, event, context);
    }
};

var handleRoute = function (event, context) {
    if (event.RequestType === 'Delete') {
        deleteRoute(event, context);
    } else if (event.RequestType === 'Create') {
        createRoute(event, context);
    } else if (event.RequestType === 'Update') {
        if (event.ResourceProperties.DestinationCIDRBlock === event.OldResourceProperties.DestinationCIDRBlock &&
            event.ResourceProperties.RouteTableId === event.OldResourceProperties.RouteTableId) {
            replaceRoute(event, context);
        } else {
            createRoute(event, context);
        }
    } else {
        errorExit("unknown type: " + event.RequestType, event, context);
    }
};

var deleteRoute = function (event, context) {
    if (!event.PhysicalResourceId.match(/^gateway-route-/)) {
        console.log("unexpected physical id for route " + event.PhysicalResourceId + " - ignoring");
        response.send(event, context, response.SUCCESS, {});
        return;
    }
    ec2.deleteRoute({
        RouteTableId: event.ResourceProperties.RouteTableId || errorExit('RouteTableId missing', event, context),
        DestinationCidrBlock: event.ResourceProperties.DestinationCidrBlock || errorExit('DestinationCidrBlock missing', event, context)
    }, function (err, data) {
        if (err) {
            errorExit("delete route failed " + err, event, context);
        } else {
            response.send(event, context, response.SUCCESS, {}, physicalId(event.ResourceProperties));
        }
    });
};

var createRoute = function (event, context) {
    ec2.createRoute({
        RouteTableId: event.ResourceProperties.RouteTableId || errorExit('RouteTableId missing', event, context),
        DestinationCidrBlock: event.ResourceProperties.DestinationCidrBlock || errorExit('DestinationCidrBlock missing', event, context),
        NatGatewayId: event.ResourceProperties.NatGatewayId || errorExit('NatGatewayId missing', event, context)
    }, function (err, data) {
        if (err) {
            errorExit("create route failed " + err, event, context);
        } else {
            response.send(event, context, response.SUCCESS, {}, physicalId(event.ResourceProperties));
        }
    });
};

var replaceRoute = function (event, context) {
    ec2.replaceRoute({
        RouteTableId: event.ResourceProperties.RouteTableId || errorExit('RouteTableId missing', event, context),
        DestinationCidrBlock: event.ResourceProperties.DestinationCidrBlock || errorExit('DestinationCidrBlock missing', event, context),
        NatGatewayId: event.ResourceProperties.NatGatewayId || errorExit('NatGatewayId missing', event, context)
    }, function (err, data) {
        if (err) {
            errorExit("replace route failed " + err, event, context);
        } else {
            response.send(event, context, response.SUCCESS, {}, physicalId(event.ResourceProperties));
        }
    });
};

var physicalId = function (properties) {
    return 'gateway-route-' + properties.RouteTableId + '-' + properties.DestinationCIDRBlock;
};

var handleGateway = function (event, context) {
    if (event.RequestType === 'Delete') {
        deleteGateway(event, context);
    } else if (event.RequestType === 'Update' || event.RequestType === 'Create') {
        createGateway(event, context);
    } else {
        errorExit("unknown type: " + event.RequestType, event, context);
    }
};

var createGateway = function (event, context) {
    ec2.createNatGateway({
        AllocationId: event.ResourceProperties.SubnetId || errorExit('subnet id not specified', event, context),
        SubnetId: event.ResourceProperties.AllocationId || errorExit('allocationId not specified', event, context)
    }, function (err, data) {
        if (err) {
            errorExit("create gateway failed " + err, event, context);
        } else {
            waitForGatewayStateChange(data.NatGateway.NatGatewayId, ['available', 'failed'], function (state) {
                response.send(event, context, response.SUCCESS, {}, data.NatGateway.NatGatewayId);
            });
        }
    });
};

var waitForGatewayStateChange = function (id, states, onComplete) {
    ec2.describeNatGateways({NatGatewayIds: [id], Filter: [{Name: "state", Values: states}]}, function (err, data) {
        if (err) {
            console.log("could not describeNatGateways " + err);
            onComplete('failed');
        } else {
            if (data.NatGateways.length > 0) {
                onComplete(data.NatGateways[0].State)
            } else {
                console.log("gateway not ready; waiting");
                setTimeout(function () { waitForGatewayStateChange(id, states, onComplete); }, 15000);
            }
        }
    });
};

var deleteGateway = function (event, context) {
    if (event.PhysicalResourceId && event.PhysicalResourceId.match(/^nat-/)) {
        ec2.deleteNatGateway({
            NatGatewayId: event.PhysicalResourceId
        }, function (err, data) {
            if (err) {
                errorExit("delete gateway failed " + err, event, context);
            } else {
                waitForGatewayStateChange(event.PhysicalResourceId, ['deleted'], function (state) {
                    response.send(event, context, response.SUCCESS, {}, event.PhysicalResourceId);
                });
            }
        })
    } else {
        console.log("No valid physical resource id passed to destroy - ignoring " + event.PhysicalResourceId);
        response.send(event, context, response.SUCCESS, {}, event.PhysicalResourceId);
    }
};

var errorExit = function (message, event, context) {
    responseData = {Error: message};
    console.log(responseData.Error);
    response.send(event, context, response.FAILED, responseData);
};
