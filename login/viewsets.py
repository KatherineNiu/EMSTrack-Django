from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, mixins, generics, filters, permissions
from rest_framework.decorators import detail_route
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ambulances.models import Ambulance, Hospital

from .models import Profile, HospitalEquipment, Equipment

from .serializers import ExtendedProfileSerializer

# Django REST Framework Viewsets

class IsUserOrAdminOrSuper(permissions.BasePermission):
    """
    Only user or staff can see or modify
    """

    def has_object_permission(self, request, view, obj):
        return (request.user.is_superuser or
                request.user.is_staff or
                obj.user == request.user)


# Profile viewset

class ProfileViewSet(viewsets.GenericViewSet):

    queryset = Profile.objects.all()
    serializer_class = ExtendedProfileSerializer
    permission_classes = (permissions.IsAuthenticated,
                          IsUserOrAdminOrSuper,)
    lookup_field = 'user__username'

    @detail_route(methods=['get'])
    def profile(self, request, **kwargs):
        return Response(ExtendedProfileSerializer(self.get_object()).data)
    
# BasePermissionViewSet

class BasePermissionViewSet(viewsets.GenericViewSet):

    filter_field = 'id'
    profile_field = 'ambulances'
    profile_values = 'ambulance_id'
    queryset = Ambulance.objects.all()
    
    def get_queryset(self):

        #print('@get_queryset {}({})'.format(self.request.user,
        #                                    self.request.method))
        
        # return all objects if superuser
        user = self.request.user
        if user.is_superuser:
            return self.queryset

        # return nothing if anonymous
        if user.is_anonymous:
            raise PermissionDenied()

        # print('> METHOD = {}'.format(self.request.method))
        # otherwise only return objects that the user can read or write to
        if self.request.method == 'GET':
            # objects that the user can read
            can_do = getattr(user.profile,
                             self.profile_field).filter(can_read=True).values(self.profile_values)

        elif (self.request.method == 'PUT' or
              self.request.method == 'PATCH' or
              self.request.method == 'DELETE'):
            # objects that the user can write to
            can_do = getattr(user.profile,
                             self.profile_field).filter(can_write=True).values(self.profile_values)
            
        else:
            raise PermissionDenied()

        #print('> user = {}, can_do = {}'.format(user, can_do))
        #print('> objects = {}'.format(Object.objects.all()))
        #print('> filtered objects = {}'.format(Object.objects.filter(id__in=can_do)))
        filter = {}
        filter[self.filter_field + '__in'] = can_do
        return self.queryset.filter(**filter)
    
# AmbulancePermission

class AmbulancePermissionViewSet(BasePermissionViewSet):

    filter_field = 'id'
    profile_field = 'ambulances'
    profile_values = 'ambulance_id'
    queryset = Ambulance.objects.all()
    
# HospitalPermission

class HospitalPermissionViewSet(BasePermissionViewSet):
    
    filter_field = 'id'
    profile_field = 'hospitals'
    profile_values = 'hospital_id'
    queryset = Hospital.objects.all()

